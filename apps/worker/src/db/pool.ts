import pg from "pg"
import type { WorkerConfig } from "../env"

// Pool Postgres du worker. Connexion Supavisor mode SESSION (port 5432) —
// impératif pour FOR UPDATE SKIP LOCKED entre commandes et les advisory locks
// (le pooler transaction 6543 les casse, règle 17). Peu de connexions, longues.

export function createPool(config: WorkerConfig): pg.Pool {
  const isLocal =
    config.databaseUrl.includes("localhost") || config.databaseUrl.includes("127.0.0.1")
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase exige TLS (certif géré par la plateforme).
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })
}
