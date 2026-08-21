import "server-only"

import { createHash, randomBytes } from "node:crypto"

import {
  createNonce,
  type OAuthStatePayload,
  type StateVerdict,
  signStateWith,
  verifyStateWith,
} from "./state-rule"

// Enveloppe serveur des règles de `state-rule.ts` : elle n'ajoute que la lecture
// du secret et l'horloge. Toute la logique testable vit dans le module voisin,
// parce que `server-only` rend celui-ci inexécutable sous `node --test`.

export { createNonce, STATE_TTL_MS } from "./state-rule"
export type { OAuthStatePayload, StateVerdict }

/** Secret HMAC du state. Lève si absent (scaffold OAuth inerte). */
export function requireStateSecret(): string {
  const value = process.env.OAUTH_STATE_SECRET
  if (!value) throw new Error("OAUTH_STATE_SECRET manquant (scaffold OAuth inerte)")
  return value
}

const secret = requireStateSecret

/** Signe le state. Le nonce vient de l'appelant : il le pose aussi dans le cookie. */
export function signState(
  payload: Omit<OAuthStatePayload, "nonce" | "exp">,
  nonce: string
): string {
  return signStateWith(payload, secret(), { nonce, nowMs: Date.now() })
}

/** Vérifie signature, forme, fraîcheur et provider. */
export function verifyState(token: string, provider: string): StateVerdict {
  return verifyStateWith(token, secret(), { nowMs: Date.now(), provider })
}

// --- PKCE ------------------------------------------------------------------
//
// ⚠ Le vérifieur ne doit JAMAIS entrer dans le state : il vit dans le cookie de
// transaction (`transaction.ts`). Le state voyage dans l'URL, à côté du code.

export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

/** Challenge PKCE S256 = base64url(sha256(verifier)). */
export function codeChallengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}
