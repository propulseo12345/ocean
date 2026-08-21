// Scopes DEMANDÉS vs scopes ACCORDÉS — et pourquoi confondre les deux coûte cher.
//
// LE DÉFAUT QUE CE MODULE FERME
// ------------------------------
// `persistConnection` écrivait `scopes: config.scopes`, c'est-à-dire la liste
// que NOUS avons demandée. Or l'utilisateur choisit, écran de consentement en
// main, ce qu'il accorde : sur Meta il peut décocher des Pages et refuser des
// permissions une par une. La base affirmait donc une capacité que la connexion
// n'avait pas — et le seul moment où on s'en apercevait était le POST de
// publication, refusé par Meta, en erreur permanente (`failed` direct, règle 18)
// sur le compte d'un vrai client.
//
// PIRE : META NE RÉTRO-ACCORDE PAS UN SCOPE
// ------------------------------------------
// Ajouter `pages_manage_posts` à la config ne le donne pas aux connexions déjà
// établies : leur jeton reste au périmètre consenti à l'époque. Sans les scopes
// réellement accordés en base, il est impossible de savoir QUELLES connexions
// doivent être refaites — on ne peut ni le dire à l'utilisateur, ni le compter.
//
// Ce module est pur (aucun `server-only`, aucun réseau) : il est donc exécuté
// par les tests, pas seulement relu.

/**
 * Découpe une chaîne de scopes.
 *
 * Les fournisseurs ne s'accordent pas sur le séparateur : espace pour OAuth 2.0
 * canonique (Google, Microsoft), virgule pour TikTok. On accepte les deux plutôt
 * que de brancher par provider — une chaîne ne peut pas être ambiguë, un scope
 * ne contenant ni espace ni virgule.
 */
export function parseScopeString(scope: string | undefined | null): string[] {
  if (!scope) return []
  return [...new Set(scope.split(/[\s,]+/).filter((s) => s.length > 0))]
}

interface MetaPermission {
  permission?: unknown
  status?: unknown
}

/**
 * Scopes réellement accordés, lus depuis `GET /me/permissions` (Meta).
 *
 * Meta ne renvoie **pas** de champ `scope` dans sa réponse de token — c'est
 * précisément pourquoi cet appel supplémentaire existe. Chaque permission y
 * porte un `status` : `granted` ou `declined`. Ne garder que les premières est
 * tout l'objet du ticket ; prendre la liste entière reproduirait le mensonge
 * sous une autre forme.
 */
export function grantedFromMetaPermissions(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const accordés: string[] = []
  for (const entrée of data as MetaPermission[]) {
    if (typeof entrée?.permission !== "string") continue
    if (entrée.status !== "granted") continue
    accordés.push(entrée.permission)
  }
  return [...new Set(accordés)]
}

/** Scopes requis mais absents des scopes accordés, dans l'ordre de `required`. */
export function missingScopes(required: readonly string[], granted: readonly string[]): string[] {
  const possédés = new Set(granted)
  return required.filter((s) => !possédés.has(s))
}

/**
 * Scopes SANS LESQUELS on ne peut pas publier, par plateforme.
 *
 * Distincts des scopes demandés : `pages_read_engagement` sert aux métriques et
 * son absence n'empêche pas un post. Ne bloquer que sur ce qui bloque vraiment —
 * une alerte qui se déclenche pour rien finit ignorée, y compris le jour où elle
 * a raison.
 */
export const PUBLISH_SCOPES: Record<string, readonly string[]> = {
  instagram: ["instagram_basic", "instagram_content_publish"],
  // `pages_manage_posts` est la permission d'écriture sur une Page. Sans elle,
  // la publication est refusée — et Meta ne l'accorde jamais rétroactivement.
  facebook: ["pages_show_list", "pages_manage_posts"],
  tiktok: ["video.upload"],
}

/** Cette connexion peut-elle publier sur cette plateforme ? */
export function canPublish(platform: string, granted: readonly string[]): boolean {
  const requis = PUBLISH_SCOPES[platform]
  if (!requis) return true
  return missingScopes(requis, granted).length === 0
}
