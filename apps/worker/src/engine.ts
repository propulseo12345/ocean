import { backoffMs } from "./backoff"
import {
  effectiveAnchor,
  LeaseLostError,
  NeedsReauthError,
  PermanentPublishError,
  type PublishJob,
} from "./domain"
import type { PublishContext, Publisher } from "./publishers/types"
import type { QuotaVerdict } from "./quota"
import type { JobStore } from "./store"

// Moteur de publication — machine à états d'UN job réclamé. C'est le cœur
// safety-critical : la RÈGLE 15 (idempotence) vit ici. Un job retrouvé avec
// publish_started_at non nul n'est JAMAIS republié à l'aveugle — on interroge
// d'abord le conteneur (double publication chez un client = catastrophe).
//
// Les appels plateforme (publisher.*) sont HORS transaction. Les écritures d'état
// passent par le store (le store gère l'atomicité DB et l'horloge now() Postgres).

export interface EngineDeps {
  store: JobStore
  resolvePublisher: (platform: PublishJob["platform"]) => Publisher
  /** Prépare le contexte : token frais (Vault) + URL signée du média. Peut lever NeedsReauth. */
  prepare: (job: PublishJob) => Promise<PublishContext>
  /**
   * Vérifie le quota AVANT publication (règle 19). Un refus dit QUAND réessayer :
   * reporter de 60 s en boucle jusqu'à épuiser la fenêtre de grâce transforme un
   * quota atteint en publication perdue.
   */
  checkQuota: (job: PublishJob) => Promise<QuotaVerdict>
  config: { graceWindowMs: number; awaitMediaDelayMs: number; httpTimeoutMs: number }
  /** Horloge de référence = now() Postgres (fourni par le store au claim). */
  now: Date
  random?: () => number
}

/**
 * Borne UN appel plateforme. Le traitement de la file est strictement
 * séquentiel : un seul appel pendu — Meta qui ne répond ni ne coupe, un socket
 * mort que le noyau garde ouvert — gèle TOUS les autres jobs, indéfiniment. Rien
 * ne le rattrapait : le heartbeat prolongeait le lease en boucle, donc le reaper
 * ne voyait jamais d'expiration.
 *
 * Le timeout ne peut pas annuler l'appel HTTP lui-même (les publishers réels
 * recevront `ctx.signal` en phase 6 pour ça). Il garantit ce qui compte ici :
 * qu'on RENDE LA MAIN. Et si l'appel dépassé était un `publish`, l'ancre est
 * déjà posée — la règle 15 interdit toute republication aveugle, donc la reprise
 * commencera par interroger le conteneur.
 */
export class PlatformTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`appel plateforme ${operation} sans reponse apres ${timeoutMs} ms`)
    this.name = "PlatformTimeoutError"
  }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PlatformTimeoutError(operation, timeoutMs)), timeoutMs)
  })
  return Promise.race([work, guard]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

/** Trop en retard pour publier (§5) — l'admin choisira une nouvelle date. */
function isTooLate(job: PublishJob, now: Date, graceWindowMs: number): boolean {
  return now.getTime() - job.runAt.getTime() > graceWindowMs
}

export async function processJob(job: PublishJob, deps: EngineDeps): Promise<void> {
  const { store, prepare, checkQuota, config, now } = deps
  const publisher = deps.resolvePublisher(job.platform)
  const nextDelay = () => backoffMs(job.attempts + 1, deps.random)
  // RÈGLE 15 : la CIBLE a peut-être déjà reçu un POST chez la plateforme — y
  // compris si cette ligne de job est neuve (migration 023).
  const started = effectiveAnchor(job).startedAt !== null

  // Fenêtre de grâce (§5) — mais JAMAIS avant d'avoir interrogé le conteneur.
  // Un job démarré abandonné sans vérification laisse une cible « failed » sur un
  // post réellement en ligne : l'admin reprogramme, et le doublon part. La
  // fenêtre est donc réévaluée dans recoverStartedJob, une fois la plateforme
  // interrogée et « rien n'est parti » établi.
  if (!started && isTooLate(job, now, config.graceWindowMs)) {
    await store.deadLetter(job, "grace_window_exceeded")
    return
  }

  // 1. Contexte : token frais + média signé. Auth perdue = permanent (needs_reauth).
  let ctx: PublishContext
  try {
    ctx = await prepare(job)
  } catch (err) {
    await handleError(store, job, err, nextDelay())
    return
  }

  // 2. Publication idempotente (RÈGLE 15) — avant le quota : interroger un
  // conteneur ne consomme aucun quota de publication, et un job démarré doit
  // pouvoir conclure même quota atteint.
  if (started) {
    try {
      await recoverStartedJob(job, publisher, ctx, deps)
    } catch (err) {
      await handleError(store, job, err, nextDelay())
    }
    return
  }

  // 3. Quota plateforme (règle 19) : atteint => report au prochain créneau.
  try {
    const quota = await checkQuota(job)
    if (!quota.ok) {
      await store.deferForQuota(job, quota.retryAfterMs, quota.reason)
      return
    }
  } catch (err) {
    await store.retryOrFail(job, err, nextDelay())
    return
  }

  try {
    await publishFresh(job, publisher, ctx, store, config.httpTimeoutMs)
  } catch (err) {
    await handleError(store, job, err, nextDelay())
  }
}

/**
 * Reprise d'un job dont publish_started_at est déjà posé (crash entre la marque
 * et/ou l'appel de publication). RÈGLE 15 : on interroge le conteneur, on ne
 * republie pas aveuglément.
 */
async function recoverStartedJob(
  job: PublishJob,
  publisher: Publisher,
  ctx: PublishContext,
  deps: EngineDeps
): Promise<void> {
  const { store, config, now } = deps
  const container = effectiveAnchor(job).containerId
  if (!container) {
    // publish_started_at sans conteneur = incohérent : on retente proprement
    // (aucune publication n'a pu partir sans conteneur).
    await store.retryOrFail(
      job,
      new Error("publish_started sans conteneur"),
      backoffMs(job.attempts + 1, deps.random)
    )
    return
  }

  const { httpTimeoutMs } = config
  const status = await withTimeout(
    publisher.getContainerStatus(job, container, ctx),
    httpTimeoutMs,
    "getContainerStatus"
  )
  if (status === "published") {
    // Déjà publié : on récupère l'id/permalink, on NE republie PAS.
    const res = await withTimeout(
      publisher.resolvePublished(job, container, ctx),
      httpTimeoutMs,
      "resolvePublished"
    )
    await store.succeed(job, res)
  } else if (status === "in_progress") {
    await store.markAwaitingMedia(job, config.awaitMediaDelayMs)
  } else {
    // error/expired : le conteneur n'a PAS publié. C'est SEULEMENT ici, la
    // plateforme interrogée, qu'abandonner un job démarré est sûr — on sait que
    // rien n'est en ligne, donc la cible « failed » ne ment pas.
    if (isTooLate(job, now, config.graceWindowMs)) {
      await store.deadLetter(job, "grace_window_exceeded")
      return
    }
    // Republier est sûr (idempotent) : le conteneur n'avait rien publié.
    const res = await withTimeout(publisher.publish(job, container, ctx), httpTimeoutMs, "publish")
    await store.succeed(job, res)
  }
}

/** Job frais : créer le conteneur, PUIS marquer publish_started_at, PUIS publier. */
async function publishFresh(
  job: PublishJob,
  publisher: Publisher,
  ctx: PublishContext,
  store: JobStore,
  httpTimeoutMs: number
): Promise<void> {
  // Un conteneur déjà créé par une tentative précédente est réutilisé — y
  // compris s'il a été persisté sur la cible et non sur cette ligne de job.
  let container = effectiveAnchor(job).containerId
  if (!container) {
    const created = await withTimeout(
      publisher.createContainer(job, ctx),
      httpTimeoutMs,
      "createContainer"
    )
    container = created.containerId
    await store.patchProgress(job, { step: "create_container", externalContainerId: container })
  }
  // RÈGLE 15 : la marque est posée et COMMITÉE avant tout appel de publication,
  // sur le job ET sur la cible (migration 023) dans la même transaction.
  await store.markPublishStarted(job, container)
  const res = await withTimeout(publisher.publish(job, container, ctx), httpTimeoutMs, "publish")
  await store.succeed(job, res)
}

function handleError(
  store: JobStore,
  job: PublishJob,
  err: unknown,
  delayMs: number
): Promise<void> {
  // Lease perdu : le job appartient à un autre worker (ou a été annulé). On n'a
  // plus le droit d'écrire, et surtout PAS de poser un statut d'échec sur le
  // travail de quelqu'un d'autre. On remonte tel quel — la boucle log, et le
  // propriétaire courant décide.
  if (err instanceof LeaseLostError) return Promise.reject(err)
  if (err instanceof NeedsReauthError) return store.failPermanent(job, err, true)
  if (err instanceof PermanentPublishError) return store.failPermanent(job, err, false)
  return store.retryOrFail(job, err, delayMs)
}
