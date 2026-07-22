import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type { OAuthTokens } from "./index"

// Écriture des tokens OAuth dans Supabase Vault (règle 12 : jamais de token en
// clair en base, jamais dans un log). Seul le client service_role peut appeler
// ces RPC (migration 019 : revoke public + grant service_role). Le VALEUR du
// token ne transite qu'ici, vers Postgres → Vault ; les tables *_secrets ne
// gardent que l'uuid du secret renvoyé.

type Admin = SupabaseClient<Database>

/** Crée un secret Vault, renvoie son uuid. Lève si la RPC échoue. */
export async function storeSecret(
  admin: Admin,
  value: string,
  description: string
): Promise<string> {
  const { data, error } = await admin.rpc("store_integration_secret", {
    _secret: value,
    _description: description,
  })
  if (error || !data) {
    // On ne loggue JAMAIS `value` (règle 12) : seul le message d'erreur RPC.
    throw new Error(`Vault store échoué: ${error?.message ?? "uuid manquant"}`)
  }
  return data
}

/** Réécrit un secret Vault existant en place (rotation — l'uuid ne change pas). */
export async function updateSecret(admin: Admin, secretId: string, value: string): Promise<void> {
  const { error } = await admin.rpc("update_integration_secret", {
    _secret_id: secretId,
    _secret: value,
  })
  if (error) throw new Error(`Vault update échoué: ${error.message}`)
}

/**
 * Upsert d'un secret : réécrit `existingId` s'il est fourni (reconnexion d'un
 * compte déjà lié → pas d'accumulation de secrets orphelins dans Vault), sinon
 * en crée un neuf. Renvoie l'uuid à stocker dans la table *_secrets.
 */
export async function upsertSecret(
  admin: Admin,
  existingId: string | null | undefined,
  value: string,
  description: string
): Promise<string> {
  if (existingId) {
    await updateSecret(admin, existingId, value)
    return existingId
  }
  return storeSecret(admin, value, description)
}

/**
 * Upsert de la paire access + refresh d'une connexion. Table-agnostique : reçoit
 * les uuids existants (reconnexion) et renvoie ceux à écrire dans la table
 * *_secrets. Le refresh est conservé si le provider n'en renvoie pas de neuf
 * (Google n'en émet qu'au premier consentement).
 */
export async function upsertTokenPair(
  admin: Admin,
  existing: { access?: string | null; refresh?: string | null },
  tokens: OAuthTokens,
  descPrefix: string
): Promise<{ accessId: string; refreshId: string | null }> {
  const accessId = await upsertSecret(
    admin,
    existing.access,
    tokens.accessToken,
    `${descPrefix} access`
  )
  const refreshId = tokens.refreshToken
    ? await upsertSecret(admin, existing.refresh, tokens.refreshToken, `${descPrefix} refresh`)
    : (existing.refresh ?? null)
  return { accessId, refreshId }
}
