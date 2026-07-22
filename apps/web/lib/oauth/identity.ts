import "server-only"

import type { OAuthProviderConfig } from "./config"
import type { OAuthTokens } from "./index"

// Résolution de l'identité de compte après échange OAuth (« me / pages… »).
// Deux niveaux :
//   - account    : le titulaire du token (platform_connections / calendar_accounts).
//   - subAccounts : les comptes publiables réels rattachés à un client
//                   (pages Facebook + comptes IG business, créateur TikTok).
// Pour Meta, le token de PAGE (distinct du token utilisateur) sert à publier :
// on le transporte par sous-compte pour le chiffrer dans social_account_secrets.

const GRAPH = "https://graph.facebook.com/v21.0"

export interface SocialSubAccount {
  platform: "instagram" | "facebook" | "tiktok"
  providerAccountId: string
  username?: string
  displayName?: string
  followers?: number
  avatarUrl?: string
  externalUrl?: string
  /** Token spécifique au compte (page Meta) — chiffré dans social_account_secrets. */
  accessToken?: string
}

export interface ResolvedIdentity {
  providerAccountId: string
  providerAccountName?: string
  /** Requis pour les comptes d'agenda (calendar_accounts.email NOT NULL). */
  email?: string
  subAccounts: SocialSubAccount[]
}

async function fetchJson(url: string, bearer?: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: bearer
      ? { Authorization: `Bearer ${bearer}`, Accept: "application/json" }
      : { Accept: "application/json" },
    // Jamais de cache pour une lecture d'identité (règle : donnée fraîche).
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Identity ${new URL(url).host}: ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

// --- Meta (Instagram + Facebook) -------------------------------------------

type MetaPage = {
  id: string
  name?: string
  username?: string
  followers_count?: number
  access_token?: string
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
    followers_count?: number
    profile_picture_url?: string
  }
}

async function resolveMeta(token: string): Promise<ResolvedIdentity> {
  const me = await fetchJson(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
  const fields =
    "id,name,username,followers_count,access_token,instagram_business_account{id,username,name,followers_count,profile_picture_url}"
  const accounts = await fetchJson(
    `${GRAPH}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`
  )
  const pages = (accounts.data as MetaPage[] | undefined) ?? []

  const subAccounts: SocialSubAccount[] = []
  for (const page of pages) {
    const pageToken = page.access_token
    subAccounts.push({
      platform: "facebook",
      providerAccountId: page.id,
      username: page.username,
      displayName: page.name,
      followers: page.followers_count,
      accessToken: pageToken,
    })
    const ig = page.instagram_business_account
    if (ig) {
      subAccounts.push({
        platform: "instagram",
        providerAccountId: ig.id,
        username: ig.username,
        displayName: ig.name ?? ig.username,
        followers: ig.followers_count,
        avatarUrl: ig.profile_picture_url,
        // IG business publie via le token de la PAGE parente, pas le token user.
        accessToken: pageToken,
      })
    }
  }

  return {
    providerAccountId: (me.id as string) ?? "",
    providerAccountName: me.name as string | undefined,
    subAccounts,
  }
}

// --- TikTok (créateur unique, brouillon) -----------------------------------

async function resolveTikTok(tokens: OAuthTokens): Promise<ResolvedIdentity> {
  const info = await fetchJson(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",
    tokens.accessToken
  )
  const user = ((info.data as Record<string, unknown>)?.user ?? {}) as {
    open_id?: string
    display_name?: string
    avatar_url?: string
  }
  const rawOpenId =
    (tokens.raw.open_id as string | undefined) ??
    ((tokens.raw.data as Record<string, unknown>)?.open_id as string | undefined)
  const openId = user.open_id ?? rawOpenId ?? ""

  return {
    providerAccountId: openId,
    providerAccountName: user.display_name,
    subAccounts: [
      {
        platform: "tiktok",
        providerAccountId: openId,
        // Le scope user.info.basic ne renvoie pas le @username : on affiche le nom.
        username: user.display_name,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        // Compte unique : le token de publication = celui de la connexion. On ne
        // duplique donc PAS le secret (pas de token par sous-compte).
      },
    ],
  }
}

// --- Google / Microsoft (agenda, lecture seule) ----------------------------

async function resolveGoogle(token: string): Promise<ResolvedIdentity> {
  const info = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", token)
  const email = info.email as string | undefined
  return {
    providerAccountId: (info.sub as string) ?? "",
    providerAccountName: (info.name as string | undefined) ?? email,
    email,
    subAccounts: [],
  }
}

async function resolveMicrosoft(token: string): Promise<ResolvedIdentity> {
  const me = await fetchJson("https://graph.microsoft.com/v1.0/me", token)
  const email = (me.mail as string | undefined) ?? (me.userPrincipalName as string | undefined)
  return {
    providerAccountId: (me.id as string) ?? "",
    providerAccountName: (me.displayName as string | undefined) ?? email,
    email,
    subAccounts: [],
  }
}

/** Résout l'identité selon le provider. Lève si l'API échoue (callback → error). */
export async function resolveIdentity(
  config: OAuthProviderConfig,
  tokens: OAuthTokens
): Promise<ResolvedIdentity> {
  switch (config.key) {
    case "meta":
      return resolveMeta(tokens.accessToken)
    case "tiktok":
      return resolveTikTok(tokens)
    case "google":
      return resolveGoogle(tokens.accessToken)
    case "microsoft":
      return resolveMicrosoft(tokens.accessToken)
  }
}
