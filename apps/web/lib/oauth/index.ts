import "server-only"

import { type OAuthProviderConfig, providerCredentials } from "./config"

// Échanges OAuth (autorisation, code→token, refresh). Une seule implémentation
// pour tous les providers ; les particularités vivent dans les configs.

export type { OAuthProviderKey } from "./config"
export { isOAuthProviderKey, OAUTH_PROVIDERS } from "./config"

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
