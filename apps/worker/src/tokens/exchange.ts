import { type FetchLike, redactSecrets, truncateBody } from "../http"
import type { RefreshedTokens, RefreshState } from "./refresh"

// Phase ② du rafraîchissement (refresh.ts) : l'appel réseau chez le fournisseur.
// Isolé ici parce que c'est la SEULE partie qui dépend du fournisseur, et parce
// que `refresh.ts` garantit qu'elle est appelée HORS VERROU et HORS TRANSACTION
// (règle 18). Un module séparé rend cette frontière visible.
//
// ⚠ AUCUN TOKEN DANS UN MESSAGE D'ERREUR. Les corps d'erreur des fournisseurs
// passent par `redactSecrets` avant d'entrer dans une exception : ils voyagent
// ensuite jusqu'à `publish_jobs.last_error`, que l'app affiche.

/** Identifiants client d'un fournisseur, lus dans l'environnement du worker. */
export interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

/** Noms des variables d'environnement, identiques à ceux du web (lib/oauth/config.ts). */
export const PROVIDER_CREDENTIAL_ENV: Record<string, [string, string]> = {
  facebook: ["OAUTH_META_CLIENT_ID", "OAUTH_META_CLIENT_SECRET"],
  instagram: ["OAUTH_META_CLIENT_ID", "OAUTH_META_CLIENT_SECRET"],
  tiktok: ["OAUTH_TIKTOK_CLIENT_KEY", "OAUTH_TIKTOK_CLIENT_SECRET"],
}

export function readProviderCredentials(
  provider: string,
  env: NodeJS.ProcessEnv = process.env
): ProviderCredentials {
  const names = PROVIDER_CREDENTIAL_ENV[provider]
  if (!names) throw new Error(`aucun echange de token defini pour le fournisseur ${provider}`)
  const [idName, secretName] = names
  const clientId = env[idName]?.trim()
  const clientSecret = env[secretName]?.trim()
  if (!clientId || !clientSecret) {
    throw new Error(`identifiants ${provider} manquants (${idName} / ${secretName})`)
  }
  return { clientId, clientSecret }
}

const GRAPH_VERSION = "v21.0"

function isoInSeconds(seconds: unknown): string | null {
  const n = typeof seconds === "number" ? seconds : Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Date.now() + n * 1000).toISOString()
}

async function readBody(res: Response, secrets: (string | null | undefined)[]): Promise<string> {
  let raw: string
  try {
    raw = await res.text()
  } catch {
    raw = "(corps illisible)"
  }
  return truncateBody(redactSecrets(raw, secrets))
}

/**
 * Meta — « rafraîchir » veut dire RÉ-ÉCHANGER un token encore valide
 * (`grant_type=fb_exchange_token`), il n'existe pas de refresh token. C'est
 * pourquoi `canSelfRefresh` est faux côté Meta et pourquoi la marge de 10 jours
 * compte : passé l'échéance, aucun chemin automatique n'existe plus, seule une
 * reconnexion humaine récupère le compte (CLAUDE.md §5).
 *
 * ⚠ Le token ré-échangé est le token UTILISATEUR de la connexion. Les tokens de
 * PAGE (`social_account_secrets`) en dérivent et n'expirent pas tant que le
 * token utilisateur reste valide : les rafraîchir n'est ni nécessaire ni
 * possible par cette voie.
 */
export async function exchangeMeta(
  state: RefreshState,
  creds: ProviderCredentials,
  fetch: FetchLike,
  signal?: AbortSignal
): Promise<RefreshedTokens> {
  const current = state.accessToken
  if (!current) {
    throw new Error("meta: aucun access token courant a re-echanger")
  }
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`)
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", creds.clientId)
  url.searchParams.set("client_secret", creds.clientSecret)
  url.searchParams.set("fb_exchange_token", current)

  const res = await fetch(url.toString(), { method: "GET", signal })
  const secrets = [current, creds.clientSecret]
  if (!res.ok) {
    throw new Error(`meta fb_exchange_token HTTP ${res.status}: ${await readBody(res, secrets)}`)
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!body.access_token) {
    throw new Error("meta fb_exchange_token: reponse sans access_token")
  }
  return {
    accessToken: body.access_token,
    // Meta n'émet pas de refresh token : on conserve `null`, et le
    // compare-and-swap de la phase ③ compare donc `null` à `null`.
    refreshToken: null,
    // Un long-lived Meta vaut 60 jours ; `expires_in` le confirme quand il est
    // présent. Absent, on n'invente pas d'échéance : `null` fera « échéance
    // inconnue » au prochain passage, donc aucun échange à l'aveugle.
    expiresAt: isoInSeconds(body.expires_in),
    refreshTokenExpiresAt: null,
  }
}

/**
 * TikTok — vrai refresh token, et il TOURNE : l'échange en renvoie un nouveau et
 * invalide l'ancien (règle 14). C'est exactement le cas que protège le
 * compare-and-swap de `refresh.ts` : deux échanges concurrents casseraient le
 * compte, et le perdant doit jeter son résultat au lieu de l'écrire.
 */
export async function exchangeTikTok(
  state: RefreshState,
  creds: ProviderCredentials,
  fetch: FetchLike,
  signal?: AbortSignal
): Promise<RefreshedTokens> {
  if (!state.refreshToken) throw new Error("tiktok: aucun refresh token stocke")
  const form = new URLSearchParams({
    client_key: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: state.refreshToken,
  })
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal,
  })
  const secrets = [state.refreshToken, creds.clientSecret]
  if (!res.ok) {
    throw new Error(`tiktok refresh_token HTTP ${res.status}: ${await readBody(res, secrets)}`)
  }
  const body = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    refresh_expires_in?: number
    error?: string
    error_description?: string
  }
  // TikTok répond 200 avec un champ `error` : sans ce test, un échec serait
  // écrit en base comme un succès, avec `access_token` undefined.
  if (body.error) {
    const detail = redactSecrets(body.error_description ?? body.error, secrets)
    throw new Error(`tiktok refresh_token: ${body.error} — ${truncateBody(detail)}`)
  }
  if (!body.access_token) throw new Error("tiktok refresh_token: reponse sans access_token")
  return {
    accessToken: body.access_token,
    // Rotation : si TikTok n'en renvoie pas, on GARDE l'ancien plutôt que
    // d'écrire `null` — écrire null effacerait le seul moyen de rafraîchir.
    refreshToken: body.refresh_token ?? state.refreshToken,
    expiresAt: isoInSeconds(body.expires_in),
    refreshTokenExpiresAt: isoInSeconds(body.refresh_expires_in),
  }
}

/** Aiguillage par fournisseur (valeur de `platform_connections.provider`). */
export function createExchange(
  fetch: FetchLike,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal
): (state: RefreshState) => Promise<RefreshedTokens> {
  return async (state) => {
    const creds = readProviderCredentials(state.provider, env)
    switch (state.provider) {
      case "facebook":
      case "instagram":
        return await exchangeMeta(state, creds, fetch, signal)
      case "tiktok":
        return await exchangeTikTok(state, creds, fetch, signal)
      default:
        throw new Error(`echange non supporte pour ${state.provider}`)
    }
  }
}
