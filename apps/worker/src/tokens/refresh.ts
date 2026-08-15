import type pg from "pg"

import { log } from "../log.js"
import { decideRefresh, peutEcrireResultat, type RefreshAction } from "./refresh-plan.js"

// Rafraîchissement d'un token OAuth — verrou par compte (règle 14) ET appel HTTP
// HORS TRANSACTION (règle 18).
//
// LES DEUX RÈGLES SEMBLENT SE CONTREDIRE, ET C'EST TOUT LE TICKET
// ----------------------------------------------------------------
// La règle 14 veut que deux rafraîchissements du même compte ne se croisent
// jamais : chez TikTok et Microsoft, l'échange REMPLACE le refresh token, donc
// deux échanges concurrents en invalident un et cassent le compte.
// La règle 18 interdit de tenir une transaction pendant un appel réseau : un
// fournisseur lent immobiliserait une connexion du pool ET le verrou, et un
// fournisseur qui ne répond jamais les immobiliserait indéfiniment.
//
// Le scaffold précédent proposait justement l'appel HTTP à l'intérieur du
// verrou (étape 1 de son commentaire) : c'était l'anti-pattern exact.
//
// LA RÉSOLUTION : TROIS PHASES
// -----------------------------
//   ① sous verrou  : lire l'état, décider, MÉMORISER le refresh token observé ;
//   ② hors verrou  : appeler le fournisseur ;
//   ③ sous verrou  : relire, vérifier que le refresh token observé est TOUJOURS
//                    celui en base (compare-and-swap), puis écrire.
//
// Le CAS de la phase ③ est ce qui rend l'appel hors verrou sûr : si un autre
// worker a rafraîchi entre-temps, notre résultat est périmé — chez un
// fournisseur à rotation, le token qu'on s'apprête à écrire est même déjà mort.
// On le jette au lieu d'écraser le sien.

/** État lu en phase ①. */
export interface RefreshState {
  connectionId: string
  provider: string
  tokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  /** Valeur du refresh token, ou `null`. Sert de clé de compare-and-swap. */
  refreshToken: string | null
  canSelfRefresh: boolean
}

/** Résultat d'un échange chez le fournisseur. */
export interface RefreshedTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  refreshTokenExpiresAt: string | null
}

export interface RefreshDeps {
  pool: pg.Pool
  /** Phase ① — lecture sous verrou. */
  load: (client: pg.PoolClient, connectionId: string) => Promise<RefreshState | null>
  /** Phase ② — appel réseau. HORS verrou par construction : pas de `client`. */
  exchange: (state: RefreshState) => Promise<RefreshedTokens>
  /** Phase ③ — écriture sous verrou, après CAS validé. */
  save: (client: pg.PoolClient, connectionId: string, tokens: RefreshedTokens) => Promise<void>
  /** Marque le compte comme nécessitant une reconnexion humaine. */
  markNeedsReauth: (client: pg.PoolClient, connectionId: string, reason: string) => Promise<void>
  now?: () => number
}

export type RefreshOutcome =
  | { kind: "skip"; reason: string }
  | { kind: "refreshed" }
  | { kind: "needs_reauth"; reason: string }
  | { kind: "abandonne"; reason: "concurrence" | "introuvable" }

/**
 * Exécute `fn` en détenant le verrou du compte. Le verrou est transactionnel
 * (`pg_advisory_xact_lock`) : impossible d'oublier de le relâcher.
 *
 * ⚠ Ne JAMAIS faire d'appel réseau dans `fn` (règle 18). La signature ne peut
 * pas l'interdire, le découpage en trois phases si.
 */
export async function withAccountLock<T>(
  pool: pg.Pool,
  accountKey: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [accountKey])
    const out = await fn(client)
    await client.query("commit")
    return out
  } catch (err) {
    await client.query("rollback")
    throw err
  } finally {
    client.release()
  }
}

export async function refreshConnection(
  deps: RefreshDeps,
  connectionId: string
): Promise<RefreshOutcome> {
  const now = deps.now ?? Date.now

  // ── ① Sous verrou : lire et décider ──────────────────────────────────────
  const phase1 = await withAccountLock(deps.pool, connectionId, async (client) => {
    const state = await deps.load(client, connectionId)
    if (!state) return null
    const decision = decideRefresh({
      tokenExpiresAt: state.tokenExpiresAt,
      refreshTokenExpiresAt: state.refreshTokenExpiresAt,
      hasRefreshToken: state.refreshToken !== null,
      canSelfRefresh: state.canSelfRefresh,
      nowMs: now(),
    })
    // `needs_reauth` est écrit ICI, dans la même transaction que la lecture :
    // c'est une conclusion tirée de l'état, aucun réseau n'est nécessaire.
    if (decision.action === "needs_reauth") {
      await deps.markNeedsReauth(client, connectionId, decision.reason)
    }
    return { state, decision }
  })

  if (!phase1) return { kind: "abandonne", reason: "introuvable" }
  const { state, decision } = phase1
  if (decision.action === "skip") return { kind: "skip", reason: decision.reason }
  if (decision.action === "needs_reauth") {
    log.warn("token.needs_reauth", {
      connectionId,
      provider: state.provider,
      reason: decision.reason,
    })
    return { kind: "needs_reauth", reason: decision.reason }
  }

  // ── ② HORS verrou : appel réseau ─────────────────────────────────────────
  // Aucune transaction n'est ouverte ici, aucune connexion du pool n'est
  // retenue. Un fournisseur qui ne répond pas ne bloque que ce tick.
  let tokens: RefreshedTokens
  try {
    tokens = await deps.exchange(state)
  } catch (err) {
    // L'échec d'échange est une conclusion, pas un silence : le compte devra
    // être reconnecté à la main (règle 14 — + email Brevo côté appelant).
    await withAccountLock(deps.pool, connectionId, (client) =>
      deps.markNeedsReauth(client, connectionId, "echange_echoue")
    )
    log.warn("token.refresh_failed", {
      connectionId,
      provider: state.provider,
      error: err instanceof Error ? err.name : "inconnu",
    })
    return { kind: "needs_reauth", reason: "echange_echoue" }
  }

  // ── ③ Sous verrou : compare-and-swap, puis écriture ──────────────────────
  return await withAccountLock(deps.pool, connectionId, async (client) => {
    const actuel = await deps.load(client, connectionId)
    if (!actuel) return { kind: "abandonne", reason: "introuvable" } as const
    if (!peutEcrireResultat(state.refreshToken, actuel.refreshToken)) {
      // Un autre worker est passé. Chez un fournisseur à rotation, le token
      // qu'on s'apprête à écrire est déjà invalidé par SON échange : l'écrire
      // casserait le compte. On jette le nôtre.
      log.warn("token.refresh_concurrent", { connectionId, provider: state.provider })
      return { kind: "abandonne", reason: "concurrence" } as const
    }
    await deps.save(client, connectionId, tokens)
    return { kind: "refreshed" } as const
  })
}

export type { RefreshAction }
