import "server-only"

import { type OAuthProviderConfig, providerCredentials } from "./config"
import { looksLongLived } from "./token-life"

// Échanges OAuth (autorisation, code→token, refresh). Une seule implémentation
// pour tous les providers ; les particularités vivent dans les configs.

export type { OAuthProviderKey } from "./config"
export { isOAuthProviderKey, OAUTH_PROVIDERS, providerKeyForConnection } from "./config"

declare const marqueLongLived: unique symbol

/**
 * Tokens dont la durée de vie a été RÉGLÉE pour ce fournisseur.
 *
 * Ce n'est pas une décoration : `resolveIdentity` n'accepte que ce type, donc
 * appeler la résolution d'identité avec le résultat brut de `exchangeCode` est
 * une **erreur de compilation**, pas une convention à respecter. C'est la seule
 * façon de rendre l'ordre des opérations impossible à inverser — un commentaire
 * ne survit pas à un refactor, une signature si.
 */
export type ReadyTokens = OAuthTokens & { readonly [marqueLongLived]: true }

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  /** Durée de vie en secondes (si fournie par le provider). */
  expiresIn?: number
  scope?: string
  /** Réponse brute (metadata provider : open_id, token_type…). */
  raw: Record<string, unknown>
}

/** URL d'autorisation (redirection du navigateur vers le provider). */
export function buildAuthorizeUrl(
  config: OAuthProviderConfig,
  opts: { state: string; redirectUri: string; codeChallenge?: string }
): string {
  const { clientId } = providerCredentials(config)
  const url = new URL(config.authorizeUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", opts.redirectUri)
  url.searchParams.set("scope", config.scopes.join(config.key === "tiktok" ? "," : " "))
  url.searchParams.set("state", opts.state)
  if (config.usePkce && opts.codeChallenge) {
    url.searchParams.set("code_challenge", opts.codeChallenge)
    url.searchParams.set("code_challenge_method", "S256")
  }
  // TikTok nomme son identifiant client `client_key`.
  if (config.key === "tiktok") {
    url.searchParams.delete("client_id")
    url.searchParams.set("client_key", clientId)
  }
  return url.toString()
}

/** Normalise une réponse de token provider en OAuthTokens. */
function toTokens(raw: Record<string, unknown>): OAuthTokens {
  const access = (raw.access_token ?? (raw.data as Record<string, unknown>)?.access_token) as
    | string
    | undefined
  if (!access) throw new Error("Réponse token OAuth sans access_token")
  const data = (raw.data as Record<string, unknown>) ?? raw
  return {
    accessToken: access,
    refreshToken: (data.refresh_token as string) ?? undefined,
    expiresIn: (data.expires_in as number) ?? undefined,
    scope: (data.scope as string) ?? undefined,
    raw,
  }
}

/** Échange le code d'autorisation contre des tokens. */
export async function exchangeCode(
  config: OAuthProviderConfig,
  opts: { code: string; redirectUri: string; codeVerifier?: string }
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = providerCredentials(config)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })
  if (config.usePkce && opts.codeVerifier) body.set("code_verifier", opts.codeVerifier)
  if (config.key === "tiktok") {
    body.delete("client_id")
    body.set("client_key", clientId)
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  })
  if (!res.ok) throw new Error(`OAuth token ${config.key}: ${res.status}`)
  return toTokens((await res.json()) as Record<string, unknown>)
}

/**
 * Meta : échange le token court (1–2 h) contre un long-lived (60 j).
 *
 * ⚠ L'ORDRE EST LE PIÈGE DE CE TICKET
 * ------------------------------------
 * Cet échange doit précéder `GET /me/accounts`. Les tokens de PAGE héritent de
 * la durée de vie du token UTILISATEUR qui les a demandés : les récupérer avec
 * le token court donne des tokens de page courts, et ce sont eux qui publient.
 * On aurait alors une connexion « valide 60 jours » dont les tokens de
 * publication meurent dans l'heure — et l'échec n'arriverait qu'à la première
 * publication programmée, chez un vrai client.
 *
 * Sans cet échange, `fb_exchange_token` n'apparaissait nulle part dans le dépôt :
 * toute connexion Meta mourait au bout d'une heure.
 */
export async function exchangeForLongLivedToken(
  config: OAuthProviderConfig,
  tokens: OAuthTokens
): Promise<ReadyTokens> {
  if (!config.needsLongLivedExchange) return tokens as ReadyTokens
  const { clientId, clientSecret } = providerCredentials(config)

  const url = new URL(config.tokenUrl)
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("client_secret", clientSecret)
  url.searchParams.set("fb_exchange_token", tokens.accessToken)

  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) throw new Error(`OAuth long-lived ${config.key}: ${res.status}`)
  const échangé = toTokens((await res.json()) as Record<string, unknown>)

  // Garde-fou : si Meta rend une durée courte, l'échange n'a pas produit ce
  // qu'on croit. Publier là-dessus donnerait des tokens de page morts dans
  // l'heure, et l'échec n'apparaîtrait qu'à la première publication programmée.
  if (!looksLongLived(échangé.expiresIn)) {
    throw new Error(
      `OAuth long-lived ${config.key}: durée courte (${échangé.expiresIn ?? "absente"})`
    )
  }

  // Meta ne renvoie pas de refresh token : on conserve celui d'origine s'il
  // existait, plutôt que de l'effacer par un `undefined`.
  return { ...échangé, refreshToken: échangé.refreshToken ?? tokens.refreshToken } as ReadyTokens
}

/**
 * Requalifie un token DÉJÀ STOCKÉ en `ReadyTokens`.
 *
 * Un token en base est passé par `exchangeForLongLivedToken` au moment de la
 * connexion : sa durée de vie est donc déjà réglée. Cette fonction existe pour
 * que ce fait soit écrit UNE fois, à un endroit nommé, plutôt que par un `as`
 * disséminé dans chaque appelant — un `as` anonyme viderait la marque de son
 * sens sans que personne ne s'en aperçoive.
 */
export function storedTokensAsReady(accessToken: string): ReadyTokens {
  return { accessToken, raw: {} } as ReadyTokens
}

/**
 * Rafraîchit les tokens (rotation TikTok/Microsoft — CLAUDE.md règle 14 : sous
 * verrou par compte, à faire côté worker/serveur, jamais concurremment).
 */
export async function refreshTokens(
  config: OAuthProviderConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = providerCredentials(config)
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })
  if (config.key === "tiktok") {
    body.delete("client_id")
    body.set("client_key", clientId)
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  })
  if (!res.ok) throw new Error(`OAuth refresh ${config.key}: ${res.status}`)
  return toTokens((await res.json()) as Record<string, unknown>)
}
