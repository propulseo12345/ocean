import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import type { OAuthProviderConfig } from "./config"
import type { ResolvedIdentity, SocialSubAccount } from "./identity"
import type { OAuthTokens } from "./index"
import { upsertSecret, upsertTokenPair } from "./secrets"

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

export async function persistConnection(
  config: OAuthProviderConfig,
  ctx: ConnectionContext,
  resolved: ResolvedIdentity,
  tokens: OAuthTokens
): Promise<void> {
  if (!resolved.providerAccountId) {
    throw new Error(`Identité ${config.key} non résolue (providerAccountId vide)`)
  }
  const admin = createAdminClient()
  if (config.isCalendar) {
    await persistCalendarAccount(admin, config, ctx, resolved, tokens)
  } else {
    await persistPlatformConnection(admin, config, ctx, resolved, tokens)
  }
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
        scopes: config.scopes,
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

async function persistPlatformConnection(
  admin: Admin,
  config: OAuthProviderConfig,
  ctx: ConnectionContext,
  resolved: ResolvedIdentity,
  tokens: OAuthTokens
): Promise<void> {
  const { data: connection, error } = await admin
    .from("platform_connections")
    .upsert(
      {
        org_id: ctx.orgId,
        provider: config.connectionProvider,
        connected_by: ctx.userId,
        provider_account_id: resolved.providerAccountId,
        provider_account_name: resolved.providerAccountName ?? null,
        status: "connected",
        scopes: config.scopes,
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

  // Les comptes publiables (pages/IG/créateur) ne se rattachent qu'avec un client
  // cible. Sans clientId (ex. connexion initiée hors espace client), on s'arrête à
  // la connexion org-level : l'admin rattachera les comptes ensuite.
  if (!ctx.clientId) return
  for (const sub of resolved.subAccounts) {
    await persistSocialAccount(admin, ctx, ctx.clientId, connection.id, config, sub)
  }
}

async function persistSocialAccount(
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
