import { createContextProvider, createQuotaChecker } from "./context"
import { PgJobStore } from "./db/pg-store"
import { createPool } from "./db/pool"
import { type EngineDeps, processJob } from "./engine"
import { loadConfig, type WorkerConfig } from "./env"
import { errorFields, log } from "./log"
import { resolvePublisher, STUB_MODE } from "./publishers"
import type { JobStore } from "./store"

// Worker de publication (2e app Coolify). Boucle tick 5 s : reaper puis drain des
// jobs dûs. Chaque job passe par la machine à états (engine.ts) qui tient la règle
// 15. Connexion Supavisor SESSION (env.ts refuse le port 6543). Arrêt gracieux.

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
  job: Parameters<typeof processJob>[0],
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

async function tick(store: JobStore, deps: EngineDeps, config: WorkerConfig): Promise<void> {
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
    await runOne(claimed.job, claimed.now, deps, config)
  }
}

async function main(): Promise<void> {
  const config = loadConfig()
  const pool = createPool(config)
  const store = new PgJobStore(pool)

  const deps: EngineDeps = {
    store,
    resolvePublisher,
    prepare: createContextProvider(pool, { stub: STUB_MODE }),
    checkQuota: createQuotaChecker(pool, { stub: STUB_MODE }),
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
    stubMode: STUB_MODE,
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
