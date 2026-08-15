import { constantTimeEquals, type OAuthStatePayload, verifyStateWith } from "./state-rule"

// La DÉCISION du callback OAuth, extraite de la route.
//
// POURQUOI EXTRAIRE
// -----------------
// Un Route Handler n'est atteignable par aucun test de `apps/web`. Laisser les
// quatre gardes dans la route les aurait rendues vraies « par lecture » — et une
// garde vraie par lecture est exactement ce qui a produit l'open redirect
// « corrigé » et la migration 033 v1. Ici elles sont exécutées, et une mutation
// les fait tomber.
//
// LES QUATRE GARDES, ET CE QUE CHACUNE FERME
// -------------------------------------------
// ① signature + fraîcheur + provider → le flux vient de nous, il n'a pas
//    expiré, et un state émis pour Meta ne vaut pas pour TikTok ;
// ② nonce du cookie == nonce du state → le navigateur qui revient est celui qui
//    est parti (ni rejeu d'un state capté, ni cookie forcé chez la victime) ;
// ③ session == `state.userId` → sans elle, le `userId` du state serait cru sur
//    parole et la connexion, avec ses tokens, atterrirait dans l'org d'un autre ;
// ④ usage unique du cookie → assuré par l'appelant, qui consomme AVANT d'appeler.

export interface CallbackInput {
  provider: string
  code: string | null
  /** Paramètre `error` renvoyé par le fournisseur (refus de l'utilisateur). */
  providerError: string | null
  stateToken: string | null
  /** Transaction déjà CONSOMMÉE par l'appelant (lue puis supprimée). */
  transaction: { nonce: string; codeVerifier?: string } | null
  /** Utilisateur de la session courante, revalidé. `null` = pas de session. */
  sessionUserId: string | null
  secret: string
  nowMs: number
}

export type CallbackDecision =
  | { ok: true; state: OAuthStatePayload; code: string; codeVerifier?: string }
  | { ok: false; error: "denied" | "missing" | "state" }

/**
 * Tranche si le callback peut échanger le code.
 *
 * Toutes les défaillances de flux rendent le MÊME code d'erreur (`state`) :
 * distinguer « nonce absent » de « session étrangère » renseignerait un
 * attaquant sur l'état de sa cible sans aider l'utilisateur légitime, pour qui
 * la conduite à tenir est identique — recommencer la connexion.
 */
export function decideCallback(input: CallbackInput): CallbackDecision {
  if (input.providerError) return { ok: false, error: "denied" }
  if (!input.code || !input.stateToken) return { ok: false, error: "missing" }

  // ① Le state est-il le nôtre, frais, et pour ce provider ?
  const verdict = verifyStateWith(input.stateToken, input.secret, {
    nowMs: input.nowMs,
    provider: input.provider,
  })
  if (!verdict.ok) return { ok: false, error: "state" }
  const state = verdict.state

  // ② Ce navigateur est-il celui qui est parti ?
  if (!input.transaction) return { ok: false, error: "state" }
  if (!constantTimeEquals(input.transaction.nonce, state.nonce)) {
    return { ok: false, error: "state" }
  }

  // ③ La session est-elle celle qui a initié le flux ?
  if (!input.sessionUserId || input.sessionUserId !== state.userId) {
    return { ok: false, error: "state" }
  }

  return {
    ok: true,
    state,
    code: input.code,
    // Le vérifieur PKCE vient du cookie, jamais du state.
    codeVerifier: input.transaction.codeVerifier,
  }
}
