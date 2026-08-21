import type { AccountStatus, Platform } from "@/lib/domain"
import { missingScopes, PUBLISH_SCOPES } from "./scopes"

// Santé RÉELLE d'un compte social — celle qui décide s'il peut publier.
//
// LE DÉFAUT QUE CE MODULE FERME (P8-7)
// -------------------------------------
// `needs_reauth` est écrit sur `platform_connections` — par le worker quand un
// rafraîchissement échoue (règle 14), et par le health check. Or `getSocialAccounts`
// ne lisait QUE `social_accounts.status` et ne joignait jamais la connexion :
// l'information la plus importante du produit (« ce compte ne peut plus
// publier ») était écrite dans une table que le web n'ouvrait jamais.
//
// Conséquence concrète : l'écran des comptes affichait « Connecté » en vert, le
// bandeau de santé restait muet, et l'utilisateur découvrait le problème quand
// un contenu programmé partait en échec — c'est-à-dire trop tard.
//
// LA CONNEXION EST LA RACINE
// ---------------------------
// Un compte social ne détient pas son autorisation : il en hérite. Si la
// connexion Meta est morte, TOUS les comptes qu'elle porte sont morts, quel que
// soit leur propre statut. La santé effective se lit donc de haut en bas.

export interface HealthInputs {
  platform: Platform
  /** Statut porté par la ligne `social_accounts`. */
  accountStatus: AccountStatus
  /** Statut de la connexion parente (`platform_connections.status`). */
  connectionStatus: AccountStatus | null
  /** `platform_connections.needs_reauth_at` — non nul = reconnexion demandée. */
  connectionNeedsReauthAt: string | null
  /** Scopes réellement accordés, stockés sur la connexion (P8-6). */
  grantedScopes: readonly string[]
}

export interface AccountHealth {
  status: AccountStatus
  /**
   * Scopes de publication manquants. Non vide = le compte est « connecté » mais
   * ne peut pas publier — un état que le statut seul ne sait pas dire.
   */
  missing: string[]
}

export function accountHealth(input: HealthInputs): AccountHealth {
  const manquants = manquantsPour(input)

  // ① Le détachement est un acte DÉLIBÉRÉ de l'utilisateur : il prime sur tout
  // le reste. Afficher « reconnexion requise » sur un compte qu'on vient de
  // détacher inviterait à défaire son propre geste.
  if (input.accountStatus === "disconnected") return { status: "disconnected", missing: [] }

  // ② La connexion parente d'abord : un compte n'a pas d'autorisation propre.
  if (input.connectionNeedsReauthAt !== null) return { status: "needs_reauth", missing: manquants }
  if (input.connectionStatus === "needs_reauth") {
    return { status: "needs_reauth", missing: manquants }
  }
  if (input.connectionStatus === "disconnected") return { status: "disconnected", missing: [] }

  // ③ Puis le compte lui-même.
  if (input.accountStatus !== "connected")
    return { status: input.accountStatus, missing: manquants }

  return { status: "connected", missing: manquants }
}

/**
 * Scopes de publication manquants.
 *
 * ⚠ Une liste de scopes VIDE veut dire « on ne sait pas », pas « rien n'est
 * accordé » : les connexions créées avant P8-6 stockaient les scopes DEMANDÉS,
 * et celles dont le fournisseur n'annonce rien stockent un tableau vide. Crier
 * « ne peut pas publier » sur toutes ces connexions transformerait l'alerte en
 * bruit dès le premier jour — et une alerte bruyante finit ignorée, y compris
 * le jour où elle a raison.
 */
function manquantsPour(input: HealthInputs): string[] {
  if (input.grantedScopes.length === 0) return []
  const requis = PUBLISH_SCOPES[input.platform]
  if (!requis) return []
  return missingScopes(requis, input.grantedScopes)
}
