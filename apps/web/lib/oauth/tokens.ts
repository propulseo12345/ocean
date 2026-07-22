import "server-only"

import type { OAuthProviderConfig } from "./config"
import type { OAuthTokens } from "./index"

// Persistance d'une connexion OAuth + ses tokens.
//
// ⚠️ RÈGLE 12 : les tokens ne vivent JAMAIS en clair en base. Ils vont dans
// Supabase Vault ; platform_connection_secrets ne stocke que les
// vault_access_token_secret_id / vault_refresh_token_secret_id (uuid Vault), et
// reste DENY-ALL (règle 11 : seul le service role y accède).
//
// Les helpers Vault (une RPC service_role wrappant vault.create_secret /
// vault.update_secret, dans le schéma private) ne sont PAS encore posés. Sans
// eux, on ne peut pas chiffrer les tokens — donc persistConnection LÈVE plutôt
// que d'écrire un secret en clair. C'est le SEUL point bloquant du flux OAuth :
// tout le reste (autorisation, échange de code, refresh) est fonctionnel.
//
// TODO Tier D (migration) :
//   - private.store_integration_secret(_org uuid, _name text, _value text) → uuid
//     (SECURITY DEFINER, service_role only, insère dans vault.secrets)
//   - upsert platform_connections (métadonnées, non secret) + platform_connection_secrets
//     (vault_*_secret_id) sous la même transaction logique.

export interface ConnectionIdentity {
  orgId: string
  /** Client cible (comptes sociaux) — absent pour un agenda org-level. */
  clientId?: string
  providerAccountId: string
  providerAccountName?: string
  scopes: string[]
}

export async function persistConnection(
  _config: OAuthProviderConfig,
  _identity: ConnectionIdentity,
  _tokens: OAuthTokens
): Promise<void> {
  throw new Error(
    "Stockage Vault des tokens OAuth non configuré (helper Vault private.store_integration_secret — migration Tier D)"
  )
}
