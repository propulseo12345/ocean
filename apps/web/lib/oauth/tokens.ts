import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database, Json } from "@/lib/supabase/types"
import type { OAuthProviderConfig } from "./config"
import type { ResolvedIdentity, SocialSubAccount } from "./identity"
import type { OAuthTokens } from "./index"
import { upsertSecret, upsertTokenPair } from "./secrets"
import type { AvailableSubAccount } from "./sub-accounts"

// Persistance d'une connexion OAuth + ses tokens (règle 12 : les tokens ne vivent
// JAMAIS en clair en base). Chaque token part dans Supabase Vault via les helpers
// service_role (secrets.ts) ; les tables *_secrets ne gardent que les uuid de
// secrets et restent DENY-ALL (règle 11 : aucun accès navigateur/authenticated).
//
// Deux familles :
//   - agenda (google/microsoft, isCalendar) → calendar_accounts (scopé user).
//   - réseau social (meta/tiktok) → platform_connections (scopé org) + un
//     social_accounts par page/compte publiable rattaché au client cible.

type Admin = SupabaseClient<Database>

/** Contexte de persistance résolu côté callback (jamais depuis le client). */
export interface ConnectionContext {
  orgId: string
  userId: string
  /** Client cible (comptes sociaux). Absent pour un agenda (org/user-level). */
  clientId?: string
}

function secondsToIso(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  return new Date(Date.now() + seconds * 1000).toISOString()
}

/** refresh_expires_in : présent chez TikTok (top-level) et Microsoft (rotation). */
function refreshExpiresIso(tokens: OAuthTokens): string | null {
  const top = tokens.raw.refresh_expires_in as number | undefined
  const nested = (tokens.raw.data as Record<string, unknown> | undefined)?.refresh_expires_in as
    | number
    | undefined
  return secondsToIso(top ?? nested)
}

/** Ce que le callback doit faire ensuite. */
export type PersistOutcome =
  | { kind: "calendar" }
  | { kind: "social"; connectionId: string; availableCount: number }

export async function persistConnection(
  config: OAuthProviderConfig,
  ctx: ConnectionContext,
  resolved: ResolvedIdentity,
  tokens: OAuthTokens
): Promise<PersistOutcome> {
  if (!resolved.providerAccountId) {
    throw new Error(`Identité ${config.key} non résolue (providerAccountId vide)`)
  }
  const admin = createAdminClient()
  if (config.isCalendar) {
    await persistCalendarAccount(admin, config, ctx, resolved, tokens)
    return { kind: "calendar" }
  }
  return await persistPlatformConnection(admin, config, ctx, resolved, tokens)
}

// --- Agenda (google / microsoft) -------------------------------------------

async function persistCalendarAccount(
  admin: Admin,
  config: OAuthProviderConfig,
  ctx: ConnectionContext,
  resolved: ResolvedIdentity,
  tokens: OAuthTokens
): Promise<void> {
  const email = resolved.email ?? resolved.providerAccountName ?? resolved.providerAccountId
  const { data: account, error } = await admin
    .from("calendar_accounts")
    .upsert(
      {
        org_id: ctx.orgId,
        user_id: ctx.userId,
        provider: config.connectionProvider,
        provider_account_id: resolved.providerAccountId,
        email,
        label: resolved.providerAccountName ?? email,
        status: "connected",
        // Les scopes ACCORDÉS, jamais ceux demandés (P8-6).
        scopes: resolved.grantedScopes,
        needs_reauth_at: null,
      },
      { onConflict: "org_id,user_id,provider,provider_account_id" }
    )
    .select("id")
    .single()
  if (error || !account) throw new Error(`calendar_accounts upsert: ${error?.message ?? "vide"}`)

  const { data: existing } = await admin
    .from("calendar_account_secrets")
    .select("vault_access_token_secret_id, vault_refresh_token_secret_id")
    .eq("calendar_account_id", account.id)
    .maybeSingle()

  const { accessId, refreshId } = await upsertTokenPair(
    admin,
    {
      access: existing?.vault_access_token_secret_id,
      refresh: existing?.vault_refresh_token_secret_id,
    },
    tokens,
    `${config.key} ${resolved.providerAccountId}`
  )

  const { error: secretError } = await admin.from("calendar_account_secrets").upsert({
    calendar_account_id: account.id,
    org_id: ctx.orgId,
    user_id: ctx.userId,
    vault_access_token_secret_id: accessId,
    vault_refresh_token_secret_id: refreshId,
    token_expires_at: secondsToIso(tokens.expiresIn),
    refresh_token_expires_at: refreshExpiresIso(tokens),
  })
  if (secretError) throw new Error(`calendar_account_secrets upsert: ${secretError.message}`)
}

// --- Réseau social (meta / tiktok) -----------------------------------------

/** Catalogue stocké dans `metadata` — SANS aucun token (règle 12). */
function catalogue(resolved: ResolvedIdentity): AvailableSubAccount[] {
  return resolved.subAccounts.map((s) => ({
    platform: s.platform,
    providerAccountId: s.providerAccountId,
    username: s.username,
    displayName: s.displayName,
    followers: s.followers,
    avatarUrl: s.avatarUrl,
  }))
}

async function persistPlatformConnection(
  admin: Admin,
  config: OAuthProviderConfig,
  ctx: ConnectionContext,
  resolved: ResolvedIdentity,
  tokens: OAuthTokens
): Promise<PersistOutcome> {
  const { data: connection, error } = await admin
    .from("platform_connections")
    .upsert(
      {
        org_id: ctx.orgId,
        provider: config.connectionProvider,
        connected_by: ctx.userId,
        provider_account_id: resolved.providerAccountId,
        provider_account_name: resolved.providerAccountName ?? null,
        // Catalogue des comptes publiables DÉCOUVERTS, sans aucun token :
        // l'écran de sélection s'en sert pour proposer, et rien de plus.
        // `metadata` est lisible par les membres de l'org — un token n'y entre
        // jamais (règle 12), et un uuid de secret Vault non plus.
        metadata: { available_accounts: catalogue(resolved) } as unknown as Json,
        status: "connected",
        // Les scopes ACCORDÉS, jamais ceux demandés (P8-6). `config.scopes` est
        // ce qu'on a DEMANDÉ ; l'utilisateur choisit ce qu'il donne, et Meta
        // laisse décocher permission par permission.
        scopes: resolved.grantedScopes,
        needs_reauth_at: null,
      },
      { onConflict: "org_id,provider,provider_account_id" }
    )
    .select("id")
    .single()
  if (error || !connection)
    throw new Error(`platform_connections upsert: ${error?.message ?? "vide"}`)

  const { data: existing } = await admin
    .from("platform_connection_secrets")
    .select("vault_access_token_secret_id, vault_refresh_token_secret_id")
    .eq("platform_connection_id", connection.id)
    .maybeSingle()

  const { accessId, refreshId } = await upsertTokenPair(
    admin,
    {
      access: existing?.vault_access_token_secret_id,
      refresh: existing?.vault_refresh_token_secret_id,
    },
    tokens,
    `${config.key} ${resolved.providerAccountId}`
  )

  const { error: secretError } = await admin.from("platform_connection_secrets").upsert({
    platform_connection_id: connection.id,
    org_id: ctx.orgId,
    vault_access_token_secret_id: accessId,
    vault_refresh_token_secret_id: refreshId,
    token_expires_at: secondsToIso(tokens.expiresIn),
    refresh_token_expires_at: refreshExpiresIso(tokens),
  })
  if (secretError) throw new Error(`platform_connection_secrets upsert: ${secretError.message}`)

  // ⚠ P8-1 — AUCUN RATTACHEMENT AUTOMATIQUE ICI, ET C'EST TOUT LE TICKET.
  //
  // Cette boucle rattachait auparavant TOUS les sous-comptes découverts au
  // `ctx.clientId` du flux. Connecter Meta depuis l'espace du client A
  // rattachait donc à A toutes les Pages et tous les comptes Instagram du
  // compte connecté — y compris ceux du client B, avec leurs tokens de
  // publication. Aucune policy ne s'y opposait : tout est dans la même org, et
  // c'est le code applicatif qui choisissait le client.
  //
  // Le rattachement est désormais un geste explicite (`attachSocialAccounts`).
  return {
    kind: "social",
    connectionId: connection.id,
    availableCount: resolved.subAccounts.length,
  }
}

export async function persistSocialAccount(
  admin: Admin,
  ctx: ConnectionContext,
  clientId: string,
  connectionId: string,
  config: OAuthProviderConfig,
  sub: SocialSubAccount
): Promise<void> {
  const { data: account, error } = await admin
    .from("social_accounts")
    .upsert(
      {
        org_id: ctx.orgId,
        client_id: clientId,
        platform_connection_id: connectionId,
        platform: sub.platform,
        provider_account_id: sub.providerAccountId,
        username: sub.username ?? null,
        display_name: sub.displayName ?? sub.username ?? null,
        status: "connected",
        followers_count: sub.followers ?? null,
        external_url: sub.externalUrl ?? null,
        avatar_url: sub.avatarUrl ?? null,
      },
      { onConflict: "client_id,platform,provider_account_id" }
    )
    .select("id")
    .single()
  if (error || !account) throw new Error(`social_accounts upsert: ${error?.message ?? "vide"}`)

  // Token spécifique au compte (page Meta) : chiffré dans social_account_secrets.
  // TikTok (compte unique) ne fournit pas de token par sous-compte → le worker lit
  // le token de la connexion. Pas de secret orphelin inutile.
  if (!sub.accessToken) return
  const { data: existing } = await admin
    .from("social_account_secrets")
    .select("vault_access_token_secret_id")
    .eq("social_account_id", account.id)
    .maybeSingle()
  const accessId = await upsertSecret(
    admin,
    existing?.vault_access_token_secret_id,
    sub.accessToken,
    `${config.key} page ${sub.providerAccountId}`
  )
  const { error: secretError } = await admin.from("social_account_secrets").upsert({
    social_account_id: account.id,
    org_id: ctx.orgId,
    client_id: clientId,
    vault_access_token_secret_id: accessId,
  })
  if (secretError) throw new Error(`social_account_secrets upsert: ${secretError.message}`)
}
