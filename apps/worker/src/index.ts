import { createContextProvider, createQuotaChecker, REAL_REFRESH } from "./context"
import { createStorageSigner } from "./media/storage-signer"
import { PgJobStore } from "./db/pg-store"
import { createPool } from "./db/pool"
import { LeaseLostError, type PublishJob } from "./domain"
import { type EngineDeps, processJob } from "./engine"
import { loadConfig, type WorkerConfig } from "./env"
import { createHealthState, markTickFailed, markTickOk, startHealthServer } from "./health"
import { errorFields, log } from "./log"
import { assertLivePublishersAvailable, resolvePublisher } from "./publishers"
import type { JobStore } from "./store"

// Worker de publication (2e app Coolify). Boucle tick 5 s : reaper puis drain des
// jobs dûs. Chaque job passe par la machine à états (engine.ts) qui tient la règle
// 15. Connexion Supavisor SESSION (env.ts refuse le port 6543). Arrêt gracieux.
//
// PUBLISHERS_MODE (obligatoire, sans défaut) décide de ce qui arrive à un job
// réclamé : live/stub le font traverser la machine à états, dry-run le relâche
// intact. Voir env.ts.

const BATCH_PER_TICK = 10
const AWAIT_MEDIA_DELAY_MS = 60_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Prolonge le lease en tâche de fond pendant un traitement long (upload chunké).
 *
 * Depuis P3-5, `extendLease` est fencé sur `worker_id` : il renvoie false quand
 * le job ne nous appartient plus. Le heartbeat s'arrête alors immédiatement —
 * continuer à prolonger le lease d'un autre worker était précisément le
 * mécanisme qui permettait à un zombie de survivre à sa propre expiration.
 */
function startLeaseHeartbeat(
  store: JobStore,
  job: PublishJob,
  leaseMs: number,
  maxProcessingMs: number
): () => void {
  const startedAt = Date.now()
  const timer: NodeJS.Timeout = setInterval(
    () => {
      // Le heartbeat MASQUAIT le reaper : il prolongeait le lease sans borne, si
      // bien qu'un job bloqué n'expirait jamais et que le seul filet contre un
      // worker coincé ne se déclenchait pas. Passé maxProcessingMs, on cesse de
      // prolonger et on laisse le lease mourir — le reaper reprendra le job.
      if (Date.now() - startedAt > maxProcessingMs) {
        clearInterval(timer)
        log.error("traitement trop long : lease non prolonge, le reaper reprendra", {
          jobId: job.id,
          workerId: job.workerId,
          elapsedMs: Date.now() - startedAt,
          maxProcessingMs,
        })
        return
      }
      store
        .extendLease(job, leaseMs)
        .then((kept) => {
          if (kept) return
          clearInterval(timer)
          log.error("lease perdu : le job appartient a un autre worker", {
            jobId: job.id,
            workerId: job.workerId,
          })
        })
        .catch((err) => {
          log.warn("lease heartbeat failed", { jobId: job.id, ...errorFields(err) })
        })
    },
    Math.max(5_000, Math.floor(leaseMs / 3))
  )
  return () => clearInterval(timer)
}

async function runOne(
  job: PublishJob,
  now: Date,
  deps: EngineDeps,
  config: WorkerConfig
): Promise<void> {
  const stopHeartbeat = startLeaseHeartbeat(deps.store, job, config.leaseMs, config.maxProcessingMs)
  try {
    await processJob(job, { ...deps, now })
  } catch (err) {
    if (err instanceof LeaseLostError) {
      // Pas un incident : le job a changé de mains (lease expiré et repris, ou
      // contenu déprogrammé pendant le lease). On s'est arrêté sans publier ni
      // écrire, ce qui est exactement le comportement voulu.
      log.warn("job abandonne : lease perdu", {
        jobId: job.id,
        workerId: job.workerId,
        operation: err.operation,
      })
    } else {
      // processJob gère déjà ses erreurs (retryOrFail…) ; ici = crash inattendu.
      // On laisse le lease expirer => le reaper reprend le job (règle 15 tient).
      log.error("job processing crashed", { jobId: job.id, ...errorFields(err) })
    }
  } finally {
    stopHeartbeat()
  }
}

/**
 * dry-run : on prouve que la file tourne (claim + lease + reaper) et on s'arrête
 * là. Le job n'entre PAS dans la machine à états — donc aucun appel plateforme,
 * aucun état terminal, et pas une ligne écrite dans content_targets ou
 * content_items. Le job est relâché tel quel, décalé de dryRunDeferMs.
 */
async function dryRunOne(store: PgJobStore, job: PublishJob, config: WorkerConfig): Promise<void> {
  log.info("dry-run: job non execute (aucune ecriture metier)", {
    jobId: job.id,
    orgId: job.orgId,
    clientId: job.clientId,
    platform: job.platform,
    contentItemId: job.contentItemId,
    contentTargetId: job.contentTargetId,
    attempts: job.attempts,
    runAt: job.runAt.toISOString(),
    deferMs: config.dryRunDeferMs,
  })
  await store.releaseForDryRun(job.id, config.dryRunDeferMs)
}

async function tick(store: PgJobStore, deps: EngineDeps, config: WorkerConfig): Promise<void> {
  const reaped = await store.reapExpired()
  if (reaped.requeued > 0 || reaped.terminalized > 0) {
    log.info("reaper", { requeued: reaped.requeued, terminalized: reaped.terminalized })
  }

  for (let i = 0; i < BATCH_PER_TICK; i++) {
    const claimed = await store.claim(config.workerId, config.leaseMs)
    if (!claimed) break
    log.info("claimed job", {
      jobId: claimed.job.id,
      platform: claimed.job.platform,
      target: claimed.job.contentTargetId,
    })
    if (config.publishersMode === "dry-run") {
      await dryRunOne(store, claimed.job, config)
      continue
    }
    await runOne(claimed.job, claimed.now, deps, config)
  }
}

async function main(): Promise<void> {
  const config = loadConfig()
  // Refus de démarrer AVANT d'ouvrir la moindre connexion : tant que les
  // publishers sont des simulations, `live` ne peut que produire de faux succès.
  if (config.publishersMode === "live") assertLivePublishersAvailable()

  const pool = createPool(config)
  // Sans ce handler, une erreur sur un client INACTIF du pool (bascule du pooler,
  // coupure réseau) est un 'error' non écouté sur un EventEmitter : Node fait
  // tomber le process, sans une ligne de log exploitable.
  pool.on("error", (err) => {
    log.error("pg pool error (client inactif)", errorFields(err))
  })
  const store = new PgJobStore(pool)
  const stub = config.publishersMode === "stub"

  // Signature des URL de médias (règle 20). Absente en stub — rien ne part —
  // et absente aussi si le projet Supabase n'est pas configuré : dans ce cas
  // les publishers recevront `media: []` et refuseront eux-mêmes de publier un
  // post sans média, plutôt que d'envoyer une URL vide à Meta.
  const storage =
    !stub && config.supabaseUrl && config.supabaseServiceRoleKey
      ? createStorageSigner({
          supabaseUrl: config.supabaseUrl,
          serviceRoleKey: config.supabaseServiceRoleKey,
          fetch: globalThis.fetch,
        })
      : null
  if (!stub && !storage) {
    log.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents : aucun media ne sera signe", {})
  }

  const deps: EngineDeps = {
    store,
    resolvePublisher,
    prepare: createContextProvider(pool, {
      stub,
      storage,
      // Le refresh n'a de sens qu'en mode réel : en stub aucun appel ne part,
      // et consommer un refresh token TikTok (à rotation) pour une simulation
      // casserait un vrai compte.
      refresh: stub
        ? null
        : { run: REAL_REFRESH, timeoutMs: config.tokenRefreshTimeoutMs },
    }),
    checkQuota: createQuotaChecker(pool, { stub }),
    config: {
      graceWindowMs: config.graceWindowMs,
      awaitMediaDelayMs: AWAIT_MEDIA_DELAY_MS,
      httpTimeoutMs: config.httpTimeoutMs,
    },
    // `now` est réécrit par tick à partir de now() Postgres (règle 17).
    now: new Date(0),
  }

  let running = true
  const shutdown = (signal: string) => {
    if (!running) return
    running = false
    log.info("shutdown requested", { signal })
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  const health = createHealthState(Date.now())
  const healthServer = config.healthPort
    ? startHealthServer(health, {
        port: config.healthPort,
        workerId: config.workerId,
        publishersMode: config.publishersMode,
        pollIntervalMs: config.pollIntervalMs,
        staleTicks: config.healthStaleTicks,
      })
    : null

  log.info("worker started", {
    workerId: config.workerId,
    publishersMode: config.publishersMode,
    pollIntervalMs: config.pollIntervalMs,
    healthPort: config.healthPort ?? null,
    maxConsecutiveTickFailures: config.maxConsecutiveTickFailures,
    httpTimeoutMs: config.httpTimeoutMs,
    maxProcessingMs: config.maxProcessingMs,
  })

  /** Panne persistante : on sort en 1 pour que Coolify redémarre vraiment. */
  let fatal: unknown = null

  while (running) {
    try {
      await tick(store, deps, config)
      markTickOk(health, Date.now())
    } catch (err) {
      markTickFailed(health, Date.now())
      log.error("tick failed", {
        ...errorFields(err),
        consecutiveFailures: health.consecutiveFailures,
        maxConsecutiveTickFailures: config.maxConsecutiveTickFailures,
      })
      // Un worker qui échoue sur 100 % de ses ticks restait « vivant » pour
      // Coolify, donc invisible. Un conteneur qui redémarre en boucle, lui, se
      // voit. Sûr vis-à-vis de la règle 15 : un tick ne peut échouer que sur
      // reapExpired/claim — runOne attrape ses propres erreurs — donc aucune
      // publication n'est en vol à cet instant.
      if (health.consecutiveFailures >= config.maxConsecutiveTickFailures) {
        fatal = err
        running = false
        break
      }
    }
    if (running) await sleep(config.pollIntervalMs)
  }

  await healthServer?.close()
  await pool.end()

  if (fatal) {
    log.error("worker abandonne apres echecs consecutifs", {
      ...errorFields(fatal),
      consecutiveFailures: health.consecutiveFailures,
      totalTicks: health.totalTicks,
      totalFailures: health.totalFailures,
    })
    process.exit(1)
  }
  log.info("worker stopped", { totalTicks: health.totalTicks, totalFailures: health.totalFailures })
}

main().catch((err) => {
  log.error("worker fatal", errorFields(err))
  process.exit(1)
})
