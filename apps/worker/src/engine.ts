import { backoffMs } from "./backoff"
import { NeedsReauthError, PermanentPublishError, type PublishJob } from "./domain"
import type { PublishContext, Publisher } from "./publishers/types"
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
  /** Vérifie le quota AVANT publication (règle 19). false => report auto. */
  checkQuota: (job: PublishJob) => Promise<boolean>
  config: { graceWindowMs: number; awaitMediaDelayMs: number }
  /** Horloge de référence = now() Postgres (fourni par le store au claim). */
  now: Date
  random?: () => number
}

export async function processJob(job: PublishJob, deps: EngineDeps): Promise<void> {
  const { store, prepare, checkQuota, config, now } = deps
  const publisher = deps.resolvePublisher(job.platform)
  const nextDelay = () => backoffMs(job.attempts + 1, deps.random)

  // Fenêtre de grâce (§5) : trop en retard, on ne publie plus — l'admin choisira
  // une nouvelle date. Publier un contenu daté avec des heures de retard nuit.
  if (now.getTime() - job.runAt.getTime() > config.graceWindowMs) {
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

  // 2. Quota plateforme (règle 19) : atteint => report auto + notification.
  try {
    if (!(await checkQuota(job))) {
      await store.deferForQuota(job, config.awaitMediaDelayMs)
      return
    }
  } catch (err) {
    await store.retryOrFail(job, err, nextDelay())
    return
  }

  // 3. Publication idempotente (RÈGLE 15).
  try {
    if (job.publishStartedAt) {
      await recoverStartedJob(job, publisher, ctx, deps)
      return
    }
    await publishFresh(job, publisher, ctx, store)
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
  const { store, config } = deps
  const container = job.externalContainerId
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

  const status = await publisher.getContainerStatus(job, container, ctx)
  if (status === "published") {
    // Déjà publié : on récupère l'id/permalink, on NE republie PAS.
    const res = await publisher.resolvePublished(job, container, ctx)
    await store.succeed(job, res)
  } else if (status === "in_progress") {
    await store.markAwaitingMedia(job.id, config.awaitMediaDelayMs)
  } else {
    // error/expired : le conteneur n'a PAS publié → republier est sûr (idempotent).
    const res = await publisher.publish(job, container, ctx)
    await store.succeed(job, res)
  }
}

/** Job frais : créer le conteneur, PUIS marquer publish_started_at, PUIS publier. */
async function publishFresh(
  job: PublishJob,
  publisher: Publisher,
  ctx: PublishContext,
  store: JobStore
): Promise<void> {
  let container = job.externalContainerId
  if (!container) {
    const created = await publisher.createContainer(job, ctx)
    container = created.containerId
    await store.patchProgress(job.id, { step: "create_container", externalContainerId: container })
  }
  // RÈGLE 15 : la marque est posée et COMMITÉE avant tout appel de publication.
  await store.markPublishStarted(job)
  const res = await publisher.publish(job, container, ctx)
  await store.succeed(job, res)
}

function handleError(
  store: JobStore,
  job: PublishJob,
  err: unknown,
  delayMs: number
): Promise<void> {
  if (err instanceof NeedsReauthError) return store.failPermanent(job, err, true)
  if (err instanceof PermanentPublishError) return store.failPermanent(job, err, false)
  return store.retryOrFail(job, err, delayMs)
}
