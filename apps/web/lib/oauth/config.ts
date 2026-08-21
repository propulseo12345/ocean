// Abstraction OAuth « IntegrationOAuthProvider » (CLAUDE.md règle 13) : une seule
// implémentation pour Meta / TikTok / Google / Microsoft. OAuth CUSTOM via Route
// Handlers — JAMAIS Supabase linkIdentity (un compte Google d'agenda ne doit
// jamais devenir une identité de connexion).
//
// SCAFFOLDING Tier D : configs complètes, code fonctionnel, mais INERTE sans les
// identifiants client (OAUTH_*_CLIENT_ID / _SECRET) et sans la couche Vault de
// persistance des tokens (règle 12 : jamais de token en clair — voir tokens.ts).

/** Clé d'un fournisseur OAuth. Meta couvre Instagram ET Facebook. */
export type OAuthProviderKey = "meta" | "tiktok" | "google" | "microsoft"

/** Valeurs de l'enum SQL public.integration_provider. */
export type IntegrationProvider = "instagram" | "facebook" | "tiktok" | "google" | "microsoft"

export interface OAuthProviderConfig {
  key: OAuthProviderKey
  authorizeUrl: string
  tokenUrl: string
  /** Scopes demandés (adapter aux permissions réellement approuvées côté plateforme). */
  scopes: string[]
  /** integration_provider(s) Ocean couverts par cette connexion. */
  providers: IntegrationProvider[]
  /**
   * Valeur `integration_provider` posée sur la ligne de connexion
   * (platform_connections / calendar_accounts). Meta se connecte via Facebook
   * Login (le token est détenu par un utilisateur Facebook) → 'facebook' ; les
   * comptes IG rattachés vivent en social_accounts.platform = 'instagram'.
   */
  connectionProvider: IntegrationProvider
  /** true = connexion d'agenda (calendar_accounts, scopé user) ; false = réseau social. */
  isCalendar: boolean
  /** PKCE (TikTok, Microsoft, Google le supportent ; Meta non). */
  usePkce: boolean
  /**
   * Meta : le token issu du code ne vit qu'une heure ou deux. Il faut l'échanger
   * contre un long-lived (60 j) via `grant_type=fb_exchange_token`. Les autres
   * fournisseurs émettent un refresh token et n'ont pas besoin de cet échange.
   */
  needsLongLivedExchange: boolean
  clientIdEnv: string
  clientSecretEnv: string
}

export const OAUTH_PROVIDERS: Record<OAuthProviderKey, OAuthProviderConfig> = {
  meta: {
    key: "meta",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      // ⚠ Permission d'ÉCRITURE sur une Page. Sans elle, tout POST est refusé.
      // Meta ne rétro-accorde JAMAIS un scope : l'ajouter plus tard ne donne
      // rien aux connexions déjà établies, il faut les refaire une par une.
      // Elle doit donc figurer ici avant la toute première connexion réelle.
      "pages_manage_posts",
      "business_management",
    ],
    providers: ["instagram", "facebook"],
    connectionProvider: "facebook",
    isCalendar: false,
    usePkce: false,
    needsLongLivedExchange: true,
    clientIdEnv: "OAUTH_META_CLIENT_ID",
    clientSecretEnv: "OAUTH_META_CLIENT_SECRET",
  },
  tiktok: {
    key: "tiktok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    // video.upload = brouillon (CLAUDE.md §5, TikTok = draft). Pas de publication directe.
    scopes: ["user.info.basic", "video.upload"],
    providers: ["tiktok"],
    connectionProvider: "tiktok",
    isCalendar: false,
    usePkce: true,
    needsLongLivedExchange: false,
    clientIdEnv: "OAUTH_TIKTOK_CLIENT_KEY",
    clientSecretEnv: "OAUTH_TIKTOK_CLIENT_SECRET",
  },
  google: {
    key: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly", "openid", "email"],
    providers: ["google"],
    connectionProvider: "google",
    isCalendar: true,
    usePkce: true,
    needsLongLivedExchange: false,
    clientIdEnv: "OAUTH_GOOGLE_CLIENT_ID",
    clientSecretEnv: "OAUTH_GOOGLE_CLIENT_SECRET",
  },
  microsoft: {
    key: "microsoft",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Calendars.Read", "offline_access", "openid", "email"],
    providers: ["microsoft"],
    connectionProvider: "microsoft",
    isCalendar: true,
    usePkce: true,
    needsLongLivedExchange: false,
    clientIdEnv: "OAUTH_MICROSOFT_CLIENT_ID",
    clientSecretEnv: "OAUTH_MICROSOFT_CLIENT_SECRET",
  },
}

/**
 * Retrouve la config depuis la valeur stockée sur la ligne de connexion.
 *
 * Meta se connecte via Facebook Login : `connectionProvider` vaut `facebook`,
 * alors que la clé de config est `meta`. Sans cette table de correspondance, un
 * rattachement relisant `platform_connections.provider` chercherait une config
 * « facebook » qui n'existe pas.
 */
export function providerKeyForConnection(provider: string): OAuthProviderKey | null {
  for (const config of Object.values(OAUTH_PROVIDERS)) {
    if (config.connectionProvider === provider) return config.key
  }
  return null
}

export function isOAuthProviderKey(value: string): value is OAuthProviderKey {
  return value === "meta" || value === "tiktok" || value === "google" || value === "microsoft"
}

/** Identifiants client d'un provider. Lève si non configurés (scaffold inerte). */
export function providerCredentials(config: OAuthProviderConfig): {
  clientId: string
  clientSecret: string
} {
  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]
  if (!clientId || !clientSecret) {
    throw new Error(`OAuth ${config.key} non configuré (${config.clientIdEnv})`)
  }
  return { clientId, clientSecret }
}
