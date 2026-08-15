"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { OAUTH_PROVIDERS, providerKeyForConnection, storedTokensAsReady } from "@/lib/oauth"
import { resolveIdentity } from "@/lib/oauth/identity"
import {
  cleDeSousCompte,
  parseAvailableSubAccounts,
  selectAttachable,
} from "@/lib/oauth/sub-accounts"
import { persistSocialAccount } from "@/lib/oauth/tokens"
import { createAdminClient } from "@/lib/supabase/admin"
import { type ActionResult, requireClientInOrg } from "./_helpers"

// P8-1 — le rattachement d'un compte social à un client devient un GESTE.
//
// Avant, `persistPlatformConnection` rattachait automatiquement tous les
// sous-comptes découverts au client depuis lequel la connexion avait été lancée.
// Pour une agence, c'était la fuite la plus directe du produit : les Pages du
// client B publiables depuis l'espace du client A, avec le token de B chiffré
// sous la ligne de A. Aucune policy ne s'y opposait — même org, et c'est le code
// applicatif qui choisissait.

const attachSchema = z.object({
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),
  /** Clés `plateforme:identifiant` cochées dans le formulaire. */
  keys: z.array(z.string().min(1).max(256)).min(1).max(100),
})

/**
 * Rattache au client les sous-comptes explicitement choisis.
 *
 * Le token de page est REDEMANDÉ au fournisseur plutôt que conservé quelque part
 * entre la connexion et la sélection : un token qui attend est un token qui
 * traîne, et il aurait fallu l'écrire hors des tables deny-all pour le retrouver.
 */
export async function attachSocialAccounts(
  input: unknown
): Promise<ActionResult<{ attached: number }>> {
  const parsed = attachSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, connectionId, keys } = parsed.data

  try {
    const { orgId } = await requireClientInOrg(clientId)
    const admin = createAdminClient()

    // La connexion doit appartenir à l'org active : sans ce filtre, un
    // `connectionId` d'une autre org rattacherait ses comptes ici.
    const { data: connection } = await admin
      .from("platform_connections")
      .select("id, provider, metadata")
      .eq("id", connectionId)
      .eq("org_id", orgId)
      .maybeSingle()
    if (!connection) return { ok: false, error: "connection_not_found" }

    const providerKey = providerKeyForConnection(connection.provider)
    if (!providerKey) return { ok: false, error: "provider" }
    const config = OAUTH_PROVIDERS[providerKey]

    // Recoupement avec le catalogue : les clés viennent du navigateur.
    const disponibles = parseAvailableSubAccounts(connection.metadata)
    const choisis = selectAttachable(disponibles, keys)
    if (choisis.length === 0) return { ok: false, error: "nothing_selected" }

    // Token utilisateur de la connexion, relu depuis Vault (service_role only,
    // migration 035). Il ne sort jamais d'ici et n'est jamais journalisé.
    const { data: secrets } = await admin
      .from("platform_connection_secrets")
      .select("vault_access_token_secret_id")
      .eq("platform_connection_id", connectionId)
      .maybeSingle()
    if (!secrets?.vault_access_token_secret_id) return { ok: false, error: "no_token" }

    const { data: accessToken, error: readError } = await admin.rpc("read_integration_secret", {
      _secret_id: secrets.vault_access_token_secret_id,
    })
    if (readError || !accessToken) return { ok: false, error: "no_token" }

    // On redemande l'identité pour obtenir les tokens de PAGE à jour. Le token
    // stocké est déjà long-lived (P8-3), donc les tokens de page qu'il produit
    // le sont aussi.
    const resolved = await resolveIdentity(config, storedTokensAsReady(accessToken))
    const parCle = new Map(
      resolved.subAccounts.map((s) => [cleDeSousCompte(s.platform, s.providerAccountId), s])
    )

    let attached = 0
    for (const choix of choisis) {
      const frais = parCle.get(cleDeSousCompte(choix.platform, choix.providerAccountId))
      // Le compte a disparu côté fournisseur depuis la connexion (Page
      // supprimée, accès retiré) : on ne crée pas une ligne qui promet une
      // publication impossible.
      if (!frais) continue
      await persistSocialAccount(
        admin,
        { orgId, userId: "" },
        clientId,
        connectionId,
        config,
        frais
      )
      attached++
    }
    if (attached === 0) return { ok: false, error: "nothing_attached" }

    revalidatePath("/settings/accounts")
    revalidatePath(`/clients/${clientId}/settings`)
    return { ok: true, data: { attached } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}
