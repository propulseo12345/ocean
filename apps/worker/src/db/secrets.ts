import type pg from "pg"
import { NeedsReauthError, type PublishJob } from "../domain"

// Lecture des tokens OAuth depuis Supabase Vault (règle 12 : jamais en clair en
// base ; seul le worker service_role/postgres lit vault.decrypted_secrets). Le
// token ne quitte jamais le worker (jamais loggé, jamais renvoyé au navigateur).

async function readVaultSecret(pool: pg.Pool, secretId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "select decrypted_secret from vault.decrypted_secrets where id = $1",
    [secretId]
  )
  return (rows[0]?.decrypted_secret as string | undefined) ?? null
}

/**
 * Charge le token d'accès à utiliser pour publier une cible. Priorité au token
 * spécifique du compte (page Meta, social_account_secrets), sinon le token de la
 * connexion (platform_connection_secrets — cas TikTok, compte unique).
 * Lève NeedsReauth si aucun token n'est stocké (le compte doit être reconnecté).
 */
export async function loadAccessToken(pool: pg.Pool, job: PublishJob): Promise<string | null> {
  const { rows } = await pool.query(
    `select sas.vault_access_token_secret_id as account_secret,
            pcs.vault_access_token_secret_id as connection_secret
     from public.social_accounts sa
     left join public.social_account_secrets sas on sas.social_account_id = sa.id
     left join public.platform_connection_secrets pcs
       on pcs.platform_connection_id = sa.platform_connection_id
     where sa.id = $1`,
    [job.socialAccountId]
  )
  const row = rows[0]
  const secretId =
    (row?.account_secret as string | null) ?? (row?.connection_secret as string | null)
  if (!secretId) return null
  const token = await readVaultSecret(pool, secretId)
  if (!token) throw new NeedsReauthError("token vault introuvable")
  return token
}
