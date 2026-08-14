import { createContextProvider, createQuotaChecker } from "./context"
import { PgJobStore } from "./db/pg-store"
import { createPool } from "./db/pool"
import type { PublishJob } from "./domain"
import { type EngineDeps, processJob } from "./engine"
import { loadConfig, type WorkerConfig } from "./env"
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

/** Prolonge le lease en tâche de fond pendant un traitement long (upload chunké). */
function startLeaseHeartbeat(store: JobStore, jobId: string, leaseMs: number): () => void {
  const timer = setInterval(
    () => {
      store.extendLease(jobId, leaseMs).catch((err) => {
        log.warn("lease heartbeat failed", { jobId, ...errorFields(err) })
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
  const stopHeartbeat = startLeaseHeartbeat(deps.store, job.id, config.leaseMs)
  try {
    await processJob(job, { ...deps, now })
  } catch (err) {
    // processJob gère déjà ses erreurs (retryOrFail…) ; ici = crash inattendu.
    // On laisse le lease expirer => le reaper reprend le job (règle 15 tient).
    log.error("job processing crashed", { jobId: job.id, ...errorFields(err) })
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
  if (reaped > 0) log.info("reaped expired leases", { count: reaped })

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
  const store = new PgJobStore(pool)
  const stub = config.publishersMode === "stub"

  const deps: EngineDeps = {
    store,
    resolvePublisher,
    prepare: createContextProvider(pool, { stub }),
    checkQuota: createQuotaChecker(pool, { stub }),
    config: { graceWindowMs: config.graceWindowMs, awaitMediaDelayMs: AWAIT_MEDIA_DELAY_MS },
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

  log.info("worker started", {
    workerId: config.workerId,
    publishersMode: config.publishersMode,
    pollIntervalMs: config.pollIntervalMs,
  })

  while (running) {
    try {
      await tick(store, deps, config)
    } catch (err) {
      log.error("tick failed", errorFields(err))
    }
    if (running) await sleep(config.pollIntervalMs)
  }

  await pool.end()
  log.info("worker stopped")
}

main().catch((err) => {
  log.error("worker fatal", errorFields(err))
  process.exit(1)
})
