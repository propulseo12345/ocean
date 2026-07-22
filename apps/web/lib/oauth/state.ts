import "server-only"

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

// State OAuth signé (anti-CSRF, CLAUDE.md §9 : callbacks protégés par state signé).
// Le state porte l'org active + le client cible + un nonce, signé HMAC avec
// OAUTH_STATE_SECRET. Le callback le vérifie AVANT tout échange de code : un
// callback non sollicité (state absent/altéré) est rejeté.

export interface OAuthState {
  provider: string
  orgId: string
  /** Utilisateur initiateur (calendar_accounts.user_id, connected_by). */
  userId: string
  /** Client cible (comptes sociaux) — absent pour un agenda org-level. */
  clientId?: string
  /** Vérifieur PKCE (renvoyé au callback pour l'échange). */
  codeVerifier?: string
  nonce: string
}

function secret(): string {
  const value = process.env.OAUTH_STATE_SECRET
  if (!value) throw new Error("OAUTH_STATE_SECRET manquant (scaffold OAuth inerte)")
  return value
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

/** Sérialise + signe le state. Retourne `<payload>.<hmac>`. */
export function signState(state: Omit<OAuthState, "nonce">): string {
  const full: OAuthState = { ...state, nonce: randomBytes(16).toString("hex") }
  const payload = b64url(JSON.stringify(full))
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url")
  return `${payload}.${mac}`
}

/** Vérifie la signature et renvoie le state, ou null si invalide. */
export function verifyState(token: string): OAuthState | null {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url")

  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState
  } catch {
    return null
  }
}

// --- PKCE ------------------------------------------------------------------

export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

/** Challenge PKCE S256 = base64url(sha256(verifier)). */
export function codeChallengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}
