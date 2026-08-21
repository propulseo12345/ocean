import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

// Règles du state OAuth — la moitié PURE, donc exécutable par les tests.
//
// POURQUOI CE FICHIER EST SÉPARÉ DE `state.ts`
// --------------------------------------------
// `state.ts` porte `import "server-only"`, qui n'est même pas résoluble sous
// `node --test` (le paquet n'existe pas : Next l'alias au build). Un module qui
// l'importe est donc **inexécutable par la suite de tests**, donc vrai « par
// lecture » seulement — le motif exact qui a laissé passer les faux positifs de
// la semaine. Même découpage que `landing-rule.ts` / `landing.ts` (P7-5).
//
// CE QUE LE STATE PROUVE, ET CE QU'IL NE PROUVE PAS
// --------------------------------------------------
// Signé HMAC, il prouve que NOUS avons émis ce flux, pour cet utilisateur, cette
// org et ce client. Il ne prouve PAS que le navigateur qui revient est celui qui
// est parti : c'est le rôle du nonce, qui n'existe que dans un cookie httpOnly
// (cf. `transaction.ts`). Les deux moitiés sont inutiles séparément — c'est le
// couplage qui ferme le flux.

/** Durée de vie d'un flux OAuth. Au-delà, l'utilisateur recommence. */
export const STATE_TTL_MS = 10 * 60 * 1000

export interface OAuthStatePayload {
  provider: string
  orgId: string
  /** Utilisateur initiateur. Le callback exige que la session courante soit lui. */
  userId: string
  /** Client cible (comptes sociaux). Absent pour un agenda org-level. */
  clientId?: string
  /** Doit correspondre au nonce du cookie de transaction. */
  nonce: string
  /** Expiration, en millisecondes epoch. */
  exp: number
}

// ⚠ `codeVerifier` N'EST PAS un champ de ce type, et son absence est le ticket.
// L'ancienne version le transportait ici. Or le state voyage dans l'URL de
// redirection, **à côté du code d'autorisation** : historique du navigateur,
// en-tête Referer, journaux du fournisseur et de tout intermédiaire. Quiconque
// voit l'URL voyait donc le code ET le vérifieur — c'est-à-dire exactement les
// deux moitiés que PKCE sépare. PKCE était présent, câblé, et sans effet.
//
// La primitive est RETIRÉE, pas contournée : aucun membre de ce type ne peut
// transporter un vérifieur, donc aucun appelant ne peut « oublier » la règle.

export type StateVerdict =
  | { ok: true; state: OAuthStatePayload }
  | { ok: false; reason: "malforme" | "signature" | "expire" | "provider" }

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url")
}

export function createNonce(): string {
  return randomBytes(32).toString("base64url")
}

/** Sérialise + signe. Retourne `<payload>.<hmac>`. */
export function signStateWith(
  payload: Omit<OAuthStatePayload, "nonce" | "exp">,
  secret: string,
  opts: { nonce: string; nowMs: number }
): string {
  const full: OAuthStatePayload = {
    ...payload,
    nonce: opts.nonce,
    exp: opts.nowMs + STATE_TTL_MS,
  }
  const body = b64url(JSON.stringify(full))
  const mac = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${mac}`
}

/** Comparaison à temps constant de deux valeurs opaques (nonces, MAC). */
export function constantTimeEquals(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  // `timingSafeEqual` lève si les longueurs diffèrent : on compare d'abord, ce
  // qui ne fuit que la longueur — publique de toute façon.
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

/** Le payload décodé a-t-il bien la forme attendue ? */
function estPayloadValide(value: unknown): value is OAuthStatePayload {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.provider !== "string" || v.provider === "") return false
  if (typeof v.orgId !== "string" || v.orgId === "") return false
  if (typeof v.userId !== "string" || v.userId === "") return false
  if (typeof v.nonce !== "string" || v.nonce === "") return false
  if (typeof v.exp !== "number" || !Number.isFinite(v.exp)) return false
  if (v.clientId !== undefined && typeof v.clientId !== "string") return false
  return true
}

/**
 * Vérifie signature, forme, fraîcheur et provider.
 *
 * L'ordre n'est pas indifférent : la signature d'abord, parce que tout ce qui
 * suit lit des champs qu'un attaquant choisirait sinon librement — y compris
 * `exp`, qu'il poserait à l'infini.
 */
export function verifyStateWith(
  token: string,
  secret: string,
  opts: { nowMs: number; provider: string }
): StateVerdict {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return { ok: false, reason: "malforme" }
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const attendu = createHmac("sha256", secret).update(body).digest("base64url")
  if (!constantTimeEquals(mac, attendu)) return { ok: false, reason: "signature" }

  let brut: unknown
  try {
    brut = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "malforme" }
  }
  if (!estPayloadValide(brut)) return { ok: false, reason: "malforme" }
  if (brut.exp <= opts.nowMs) return { ok: false, reason: "expire" }
  if (brut.provider !== opts.provider) return { ok: false, reason: "provider" }
  return { ok: true, state: brut }
}
