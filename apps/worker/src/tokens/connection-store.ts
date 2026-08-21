import type pg from "pg"
import type { RefreshedTokens, RefreshState } from "./refresh"

// Les trois accès base du rafraîchissement (phases ① et ③ de refresh.ts),
// écrits contre le schéma réel : `platform_connections` +
// `platform_connection_secrets` + Vault.
//
// Le worker se connecte en rôle Postgres direct (Supavisor SESSION), il lit
// donc `vault.decrypted_secrets` et appelle `vault.update_secret` sans passer
// par les RPC `public.*_integration_secret` (celles-ci existent pour le WEB, qui
// parle à PostgREST et ne peut atteindre que le schéma exposé — 019).
//
// ⚠ Aucune de ces fonctions ne journalise : elles manipulent des tokens en
// clair. Le seul retour visible est un `RefreshOutcome` (refresh.ts).

/**
 * Le fournisseur sait-il rafraîchir sans intervention humaine ?
 *
 * Meta : NON. Il n'a pas de refresh token — il ré-échange un token encore
 * valide. Une fois l'échéance passée, aucun chemin automatique n'existe.
 * TikTok : oui, vrai refresh token (à rotation).
 */
export function canSelfRefresh(provider: string): boolean {
  return provider === "tiktok" || provider === "google" || provider === "microsoft"
}

interface ConnectionRow extends Record<string, unknown> {
  id: string
  provider: string
  token_expires_at: Date | null
  refresh_token_expires_at: Date | null
  access_token: string | null
  refresh_token: string | null
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

/** Phase ① — lecture sous verrou. Déchiffre les deux secrets Vault. */
export async function loadConnectionState(
  client: pg.PoolClient,
  connectionId: string
): Promise<RefreshState | null> {
  const { rows } = await client.query<ConnectionRow>(
    `select pc.id,
            pc.provider::text as provider,
            pcs.token_expires_at,
            pcs.refresh_token_expires_at,
            va.decrypted_secret as access_token,
            vr.decrypted_secret as refresh_token
     from public.platform_connections pc
     left join public.platform_connection_secrets pcs
       on pcs.platform_connection_id = pc.id
     left join vault.decrypted_secrets va on va.id = pcs.vault_access_token_secret_id
     left join vault.decrypted_secrets vr on vr.id = pcs.vault_refresh_token_secret_id
     where pc.id = $1`,
    [connectionId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    connectionId: row.id,
    provider: row.provider,
    tokenExpiresAt: iso(row.token_expires_at),
    refreshTokenExpiresAt: iso(row.refresh_token_expires_at),
    refreshToken: row.refresh_token,
    accessToken: row.access_token,
    canSelfRefresh: canSelfRefresh(row.provider),
  }
}

/**
 * Phase ③ — écriture sous verrou, APRÈS compare-and-swap validé.
 *
 * Les secrets Vault sont réécrits EN PLACE (`vault.update_secret`) : l'uuid ne
 * change pas, donc la ligne `platform_connection_secrets` et tout ce qui la
 * référence restent valides. Créer un nouveau secret à chaque rotation
 * laisserait derrière lui une traînée de secrets orphelins que personne ne
 * purge — et le worker lirait l'ancien tant que la ligne n'est pas mise à jour.
 */
export async function saveConnectionTokens(
  client: pg.PoolClient,
  connectionId: string,
  tokens: RefreshedTokens
): Promise<void> {
  const { rows } = await client.query<{
    vault_access_token_secret_id: string | null
    vault_refresh_token_secret_id: string | null
  }>(
    `select vault_access_token_secret_id, vault_refresh_token_secret_id
     from public.platform_connection_secrets
     where platform_connection_id = $1
     for update`,
    [connectionId]
  )
  const existing = rows[0]
  if (!existing) {
    // Aucune ligne de secrets : la connexion n'a jamais été autorisée, ou elle
    // a été révoquée. Écrire un token ici fabriquerait une connexion à moitié
    // vivante ; on refuse, l'appelant conclura needs_reauth.
    throw new Error(`platform_connection_secrets absent pour ${connectionId}`)
  }

  const accessId = await upsertVaultSecret(
    client,
    existing.vault_access_token_secret_id,
    tokens.accessToken,
    `access token connexion ${connectionId}`
  )
  const refreshId = tokens.refreshToken
    ? await upsertVaultSecret(
        client,
        existing.vault_refresh_token_secret_id,
        tokens.refreshToken,
        `refresh token connexion ${connectionId}`
      )
    : existing.vault_refresh_token_secret_id

  await client.query(
    `update public.platform_connection_secrets
     set vault_access_token_secret_id = $2,
         vault_refresh_token_secret_id = $3,
         token_expires_at = $4::timestamptz,
         refresh_token_expires_at = coalesce($5::timestamptz, refresh_token_expires_at),
         updated_at = now()
     where platform_connection_id = $1`,
    [connectionId, accessId, refreshId, tokens.expiresAt, tokens.refreshTokenExpiresAt]
  )

  // Un rafraîchissement réussi lève l'état « à reconnecter » posé par un échec
  // précédent : sans ça, le bandeau de santé resterait allumé pour toujours sur
  // un compte redevenu sain.
  await client.query(
    `update public.platform_connections
     set status = 'connected', needs_reauth_at = null, last_health_checked_at = now()
     where id = $1 and status = 'needs_reauth'`,
    [connectionId]
  )
}

async function upsertVaultSecret(
  client: pg.PoolClient,
  secretId: string | null,
  secret: string,
  description: string
): Promise<string> {
  if (secretId) {
    await client.query("select vault.update_secret($1::uuid, $2)", [secretId, secret])
    return secretId
  }
  const { rows } = await client.query<{ id: string }>(
    "select vault.create_secret($1, null, $2) as id",
    [secret, description]
  )
  const id = rows[0]?.id
  if (!id) throw new Error("vault.create_secret n a rien renvoye")
  return id
}

/** Le compte a besoin d'une reconnexion humaine (règle 14). */
export async function markConnectionNeedsReauth(
  client: pg.PoolClient,
  connectionId: string,
  reason: string
): Promise<void> {
  await client.query(
    `update public.platform_connections
     set status = 'needs_reauth',
         needs_reauth_at = coalesce(needs_reauth_at, now()),
         last_health_checked_at = now(),
         metadata = jsonb_set(metadata, '{needs_reauth_reason}', to_jsonb($2::text), true)
     where id = $1`,
    [connectionId, reason]
  )
}
