import type pg from "pg"
import { NeedsReauthError } from "../domain"
import type { FetchLike } from "../http"
import { log } from "../log"
import {
  canSelfRefresh,
  loadConnectionState,
  markConnectionNeedsReauth,
  saveConnectionTokens,
} from "./connection-store"
import { createExchange } from "./exchange"
import { type RefreshOutcome, refreshConnection } from "./refresh"

// T1-2 — brancher le rafraîchissement réel sur le chemin de publication.
//
// `refresh.ts` (P8-4) tient le verrou par compte et le compare-and-swap ; il
// n'avait aucune implémentation de ses quatre dépendances, donc AUCUN appelant :
// le token n'était jamais rafraîchi, `prepare()` lisait ce qui traînait en base.
// Ce module fournit les quatre, et décide de ce qu'on fait du verdict.

/** Fournisseurs pour lesquels un rafraîchissement automatique a un sens. */
const REFRESHABLE = new Set(["facebook", "instagram", "tiktok"])

/**
 * Rafraîchit le token de la connexion d'un job, si nécessaire.
 *
 * CE QUI EST FATAL ET CE QUI NE L'EST PAS — la distinction fait tout le ticket.
 *
 *   `needs_reauth` est FATAL : le compte a perdu son autorisation, aucun POST ne
 *   peut aboutir. On lève `NeedsReauthError`, le moteur pose `failed` sans
 *   retry (règle 18) et marque la connexion à reconnecter.
 *
 *   Tout le reste ne l'est pas. `skip` (rien à faire), `abandonne` (un autre
 *   worker est passé, ou la connexion a disparu) : le token en base est
 *   utilisable tel quel, publier reste la bonne conduite. Refuser de publier
 *   parce qu'un renouvellement PRÉVENTIF n'a pas eu lieu transformerait une
 *   précaution en panne, à l'heure exacte où le client attend son post.
 */
export async function refreshConnectionForJob(
  pool: pg.Pool,
  connectionId: string,
  provider: string,
  fetchImpl: FetchLike = globalThis.fetch,
  signal?: AbortSignal
): Promise<void> {
  if (!REFRESHABLE.has(provider)) return

  let outcome: RefreshOutcome
  try {
    outcome = await refreshConnection(
      {
        pool,
        load: loadConnectionState,
        exchange: createExchange(fetchImpl, process.env, signal),
        save: saveConnectionTokens,
        markNeedsReauth: markConnectionNeedsReauth,
      },
      connectionId
    )
  } catch (err) {
    // Une panne du mécanisme lui-même (base injoignable pendant le verrou,
    // identifiants absents) ne doit pas empêcher d'essayer de publier avec le
    // token courant. On le journalise — sans le token.
    log.warn("refresh de token impossible, publication avec le token en base", {
      connectionId,
      provider,
      error: err instanceof Error ? err.name : "inconnu",
    })
    return
  }

  if (outcome.kind === "needs_reauth") {
    throw new NeedsReauthError(`connexion ${connectionId} a reconnecter (${outcome.reason})`)
  }
  if (outcome.kind === "refreshed") {
    log.info("token rafraichi avant publication", { connectionId, provider })
  }
}

/**
 * Un fournisseur SANS auto-refresh (Meta) n'a qu'une fenêtre : tant que le token
 * est valide, on peut le ré-échanger. Exposé pour que le futur job quotidien de
 * refresh (CLAUDE.md §5) partage la même règle que le chemin de publication.
 */
export { canSelfRefresh }
