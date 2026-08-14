import http from "node:http"
import { errorFields, log } from "./log"

// Signe de vie du worker.
//
// Le worker est un process pur : Coolify ne peut que constater que le process
// existe. Or la boucle attrape TOUTES les erreurs de tick et continue — un worker
// qui échoue sur 100 % de ses ticks (pooler basculé, mot de passe tourné,
// DATABASE_URL écrasée) reste « running / healthy » indéfiniment, sans publier
// une seule fois. C'est le scénario du vendredi soir : douze posts programmés
// restent `scheduled`, personne ne le sait avant lundi, et la fenêtre de grâce
// de 2 h les a tous envoyés en dead_letter.
//
// Deux réponses complémentaires ici :
//   1. un état de santé lisible en HTTP (503 quand le dernier tick réussi est
//      trop ancien) — branchable comme healthcheck Coolify ;
//   2. un compteur d'échecs consécutifs, exploité par index.ts pour finir par
//      sortir en code 1 : un conteneur qui redémarre en boucle est VISIBLE,
//      un conteneur vert qui ne fait rien ne l'est pas.

export interface HealthState {
  readonly startedAt: number
  lastOkTickAt: number | null
  lastFailureAt: number | null
  consecutiveFailures: number
  totalTicks: number
  totalFailures: number
}

export function createHealthState(now: number): HealthState {
  return {
    startedAt: now,
    lastOkTickAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    totalTicks: 0,
    totalFailures: 0,
  }
}

export function markTickOk(state: HealthState, now: number): void {
  state.lastOkTickAt = now
  state.consecutiveFailures = 0
  state.totalTicks += 1
}

export function markTickFailed(state: HealthState, now: number): void {
  state.lastFailureAt = now
  state.consecutiveFailures += 1
  state.totalTicks += 1
  state.totalFailures += 1
}

export interface HealthOptions {
  now: number
  pollIntervalMs: number
  /** Nombre de ticks manqués tolérés avant de se déclarer malade. */
  staleTicks: number
}

export interface HealthReport {
  ok: boolean
  status: "ok" | "starting" | "stale"
  ageMs: number | null
  consecutiveFailures: number
  totalTicks: number
  totalFailures: number
  uptimeMs: number
}

/**
 * Santé = « un tick a réussi récemment ». Au démarrage, on laisse passer la même
 * fenêtre de tolérance avant de crier : un worker qui vient de démarrer n'a pas
 * encore de tick réussi, ce n'est pas une panne.
 */
export function healthReport(state: HealthState, opts: HealthOptions): HealthReport {
  const toleranceMs = Math.max(1, opts.staleTicks) * opts.pollIntervalMs
  const base = {
    consecutiveFailures: state.consecutiveFailures,
    totalTicks: state.totalTicks,
    totalFailures: state.totalFailures,
    uptimeMs: opts.now - state.startedAt,
  }

  if (state.lastOkTickAt === null) {
    const starting = opts.now - state.startedAt <= toleranceMs
    return { ...base, ok: starting, status: starting ? "starting" : "stale", ageMs: null }
  }

  const ageMs = opts.now - state.lastOkTickAt
  const fresh = ageMs <= toleranceMs
  return { ...base, ok: fresh, status: fresh ? "ok" : "stale", ageMs }
}

export interface HealthServerOptions extends Omit<HealthOptions, "now"> {
  port: number
  workerId: string
  publishersMode: string
  clock?: () => number
}

/**
 * Mini serveur HTTP de santé. Volontairement sans dépendance et sans routeur :
 * il doit rester le composant le moins susceptible de tomber du worker.
 * 200 tant que le dernier tick réussi est récent, 503 sinon.
 */
export function startHealthServer(
  state: HealthState,
  opts: HealthServerOptions
): { close: () => Promise<void> } {
  const clock = opts.clock ?? Date.now

  const server = http.createServer((req, res) => {
    const report = healthReport(state, {
      now: clock(),
      pollIntervalMs: opts.pollIntervalMs,
      staleTicks: opts.staleTicks,
    })
    const body = JSON.stringify({
      ...report,
      workerId: opts.workerId,
      publishersMode: opts.publishersMode,
    })
    res.writeHead(report.ok ? 200 : 503, {
      "content-type": "application/json",
      "cache-control": "no-store",
    })
    res.end(req.method === "HEAD" ? undefined : body)
  })

  server.on("error", (err) => {
    // Ne jamais faire tomber le worker parce que la sonde de santé n'a pas pu
    // se lier : publier reste plus important qu'être observable.
    log.error("health server failed", { port: opts.port, ...errorFields(err) })
  })

  server.listen(opts.port, () => {
    log.info("health server listening", { port: opts.port })
  })

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}
