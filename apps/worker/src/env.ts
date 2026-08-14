// Configuration du worker. La connexion Postgres DOIT être Supavisor mode SESSION
// (port 5432) — JAMAIS le pooler transaction (6543 casse les advisory locks et
// FOR UPDATE ... SKIP LOCKED entre commandes). L'horloge de référence est now()
// Postgres, pas l'horloge du process (règle 17).
//
// Même esprit pour PUBLISHERS_MODE : le worker refuse de démarrer plutôt que de
// choisir à la place de l'opérateur. Un worker qui publie — ou qui simule — par
// accident est bien pire qu'un worker qui ne démarre pas.

/**
 * Mode d'exécution des publishers. AUCUNE valeur par défaut : la variable est
 * obligatoire.
 *
 * - `live`    : publishers réels, POST réels chez Meta/TikTok (phase 6).
 * - `stub`    : simulation qui écrit `content_targets.status = 'published'` avec
 *               un permalink `https://stub.local/…`. Autorisé UNIQUEMENT sur une
 *               base locale — sur une base distante, ces faux permalinks sont
 *               affichés au client et `enqueue_publish_jobs` exclut ensuite
 *               définitivement la cible du ré-enfilement (réparation = SQL
 *               service_role).
 * - `dry-run` : claim, lease et reaper normaux, mais le job n'est pas exécuté :
 *               aucun état terminal, aucune écriture sur content_targets ni
 *               content_items. C'est le mode de la phase 1 — prouver la file en
 *               production sans le moindre effet de bord.
 */
export type PublishersMode = "live" | "stub" | "dry-run"

const PUBLISHERS_MODES: readonly PublishersMode[] = ["live", "stub", "dry-run"]

export interface WorkerConfig {
  databaseUrl: string
  workerId: string
  /** Mode des publishers (PUBLISHERS_MODE, obligatoire). */
  publishersMode: PublishersMode
  /** Intervalle de tick (défaut 5 s, CLAUDE.md §5). */
  pollIntervalMs: number
  /** Lease d'un job réclamé (défaut 2 min, règle 17). */
  leaseMs: number
  /** Fenêtre de grâce : au-delà, on ne publie plus, dead_letter + notif (§5). */
  graceWindowMs: number
  /** Tentatives max avant échec définitif (règle 18). */
  maxAttempts: number
  /** dry-run : délai avant qu'un job relâché redevienne claimable (anti-spam). */
  dryRunDeferMs: number
  /** Port du serveur de santé HTTP. `null` = pas de serveur (défaut en dev). */
  healthPort: number | null
  /** Ticks manqués tolérés avant que /health réponde 503. */
  healthStaleTicks: number
  /** Échecs de tick consécutifs avant d'abandonner (exit 1 => redémarrage). */
  maxConsecutiveTickFailures: number
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n <= 0) throw new Error(`${name} invalide: ${raw}`)
  return n
}

/** Entier facultatif : absent => la fonctionnalité est désactivée, pas de défaut. */
function optionalInt(name: string): number | null {
  const raw = process.env[name]?.trim()
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n <= 0) throw new Error(`${name} invalide: ${raw}`)
  return n
}

/**
 * Vrai uniquement pour une base qui tourne sur la machine du développeur. Fermé
 * par défaut : tout ce qui n'est pas reconnu est considéré comme distant, donc
 * comme de la production potentielle.
 */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  let host: string
  try {
    host = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return false
  }
  // new URL laisse les crochets des adresses IPv6 : [::1] -> "[::1]".
  const bare = host.replace(/^\[|\]$/g, "")
  if (bare === "localhost" || bare === "::1" || bare === "host.docker.internal") return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)
}

/**
 * Résout PUBLISHERS_MODE. Lève — sans jamais retomber sur une valeur par défaut —
 * si la variable manque, si elle est inconnue, ou si le mode `stub` est demandé
 * sur une base non locale.
 */
export function resolvePublishersMode(
  raw: string | undefined,
  databaseUrl: string
): PublishersMode {
  const value = raw?.trim().toLowerCase()
  if (!value) {
    throw new Error(
      "PUBLISHERS_MODE manquant — valeurs acceptées : live | stub | dry-run. " +
        "Aucune valeur par défaut : le worker refuse de choisir à ta place. " +
        "En production, c'est dry-run tant que les publishers ne sont pas réels."
    )
  }
  if (!PUBLISHERS_MODES.includes(value as PublishersMode)) {
    throw new Error(
      `PUBLISHERS_MODE invalide: ${raw} — valeurs acceptées : ${PUBLISHERS_MODES.join(" | ")}`
    )
  }
  const mode = value as PublishersMode
  if (mode === "stub" && !isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(
      "PUBLISHERS_MODE=stub est interdit sur une base non locale. Le stub écrit " +
        "content_targets.status = 'published' avec un permalink https://stub.local/… : " +
        "le client verrait « Publié » et un lien mort sur un contenu jamais publié, et " +
        "enqueue_publish_jobs n'accepterait plus de ré-enfiler cette cible. " +
        "Sur une base distante, utiliser dry-run."
    )
  }
  return mode
}

/**
 * Charge la config depuis l'environnement. Lève si DATABASE_URL manque (le worker
 * n'a aucun sens sans base). Refuse explicitement le port 6543 (pooler transaction)
 * et un PUBLISHERS_MODE absent, inconnu, ou stub sur une base distante.
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
    publishersMode: resolvePublishersMode(process.env.PUBLISHERS_MODE, databaseUrl),
    pollIntervalMs: int("WORKER_POLL_MS", 5000),
    leaseMs: int("WORKER_LEASE_MS", 120000),
    graceWindowMs: int("WORKER_GRACE_MS", 2 * 60 * 60 * 1000),
    maxAttempts: int("WORKER_MAX_ATTEMPTS", 5),
    dryRunDeferMs: int("WORKER_DRY_RUN_DEFER_MS", 15 * 60 * 1000),
    // Optionnel en dev (aucun port ouvert par défaut), posé par le Dockerfile
    // pour que Coolify dispose d'un vrai healthcheck en production.
    healthPort: optionalInt("WORKER_HEALTH_PORT"),
    healthStaleTicks: int("WORKER_HEALTH_STALE_TICKS", 6),
    // 60 ticks à 5 s ≈ 5 min : une bascule de pooler ne redémarre pas le
    // conteneur, une panne installée si.
    maxConsecutiveTickFailures: int("WORKER_MAX_CONSECUTIVE_TICK_FAILURES", 60),
  }
}
