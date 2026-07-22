// Configuration du worker. La connexion Postgres DOIT être Supavisor mode SESSION
// (port 5432) — JAMAIS le pooler transaction (6543 casse les advisory locks et
// FOR UPDATE ... SKIP LOCKED entre commandes). L'horloge de référence est now()
// Postgres, pas l'horloge du process (règle 17).

export interface WorkerConfig {
  databaseUrl: string
  workerId: string
  /** Intervalle de tick (défaut 5 s, CLAUDE.md §5). */
  pollIntervalMs: number
  /** Lease d'un job réclamé (défaut 2 min, règle 17). */
  leaseMs: number
  /** Fenêtre de grâce : au-delà, on ne publie plus, dead_letter + notif (§5). */
  graceWindowMs: number
  /** Tentatives max avant échec définitif (règle 18). */
  maxAttempts: number
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n <= 0) throw new Error(`${name} invalide: ${raw}`)
  return n
}

/**
 * Charge la config depuis l'environnement. Lève si DATABASE_URL manque (le worker
 * n'a aucun sens sans base). Refuse explicitement le port 6543 (pooler transaction).
 */
export function loadConfig(): WorkerConfig {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant (Supavisor mode SESSION, port 5432)")
  }
  if (databaseUrl.includes(":6543")) {
    throw new Error(
      "DATABASE_URL pointe le pooler transaction (6543) — le worker exige le mode SESSION (5432)"
    )
  }
  return {
    databaseUrl,
    workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
    pollIntervalMs: int("WORKER_POLL_MS", 5000),
    leaseMs: int("WORKER_LEASE_MS", 120000),
    graceWindowMs: int("WORKER_GRACE_MS", 2 * 60 * 60 * 1000),
    maxAttempts: int("WORKER_MAX_ATTEMPTS", 5),
  }
}
