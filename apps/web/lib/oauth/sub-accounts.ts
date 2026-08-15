// Catalogue des sous-comptes d'une connexion, et règles de rattachement.
//
// LE DÉFAUT QUE CE MODULE FERME (P8-1)
// -------------------------------------
// `persistPlatformConnection` bouclait sur **tous** les `resolved.subAccounts` et
// les rattachait au `clientId` du flux. Connecter Meta depuis l'espace du client
// A rattachait donc à A **toutes** les Pages Facebook et tous les comptes
// Instagram du compte connecté — avec leurs tokens de publication.
//
// Pour une agence, c'est la fuite la plus directe du produit : les comptes du
// client B deviennent publiables depuis l'espace du client A, et le token de B
// est chiffré sous la ligne de A. Aucune policy ne s'y oppose : tout est dans la
// même org, et c'est le code applicatif qui a choisi le client.
//
// Le rattachement devient donc un GESTE EXPLICITE, et ce module en porte les
// règles — pures, donc exécutées par les tests.

/** Entrée du catalogue, telle que stockée dans `platform_connections.metadata`. */
export interface AvailableSubAccount {
  platform: "instagram" | "facebook" | "tiktok"
  providerAccountId: string
  username?: string
  displayName?: string
  followers?: number
  avatarUrl?: string
}

/**
 * Relit le catalogue depuis le `metadata` jsonb.
 *
 * Défensif par nécessité : `metadata` est un `jsonb` libre, écrit par une version
 * antérieure du code ou par une main humaine dans le SQL Editor. Une entrée
 * malformée est ignorée plutôt que de faire planter l'écran de sélection —
 * mais elle n'est jamais devinée.
 */
export function parseAvailableSubAccounts(metadata: unknown): AvailableSubAccount[] {
  if (typeof metadata !== "object" || metadata === null) return []
  const brut = (metadata as { available_accounts?: unknown }).available_accounts
  if (!Array.isArray(brut)) return []

  const sorties: AvailableSubAccount[] = []
  for (const entrée of brut) {
    if (typeof entrée !== "object" || entrée === null) continue
    const e = entrée as Record<string, unknown>
    const platform = e.platform
    const id = e.providerAccountId
    if (platform !== "instagram" && platform !== "facebook" && platform !== "tiktok") continue
    if (typeof id !== "string" || id === "") continue
    sorties.push({
      platform,
      providerAccountId: id,
      username: typeof e.username === "string" ? e.username : undefined,
      displayName: typeof e.displayName === "string" ? e.displayName : undefined,
      followers: typeof e.followers === "number" ? e.followers : undefined,
      avatarUrl: typeof e.avatarUrl === "string" ? e.avatarUrl : undefined,
    })
  }
  return sorties
}

/**
 * Ne garde que les sous-comptes RÉELLEMENT présents dans le catalogue.
 *
 * C'est une garde de sécurité, pas un filtre de confort : la liste des identifiants
 * demandés vient du NAVIGATEUR. Sans ce recoupement, un `providerAccountId`
 * fabriqué créerait une ligne `social_accounts` désignant une Page que la
 * connexion ne possède pas — et le worker tenterait ensuite de publier dessus
 * avec le token de la connexion.
 *
 * Le rapprochement se fait sur le COUPLE (plateforme, identifiant) : un même
 * identifiant numérique peut exister des deux côtés chez Meta, et ne comparer
 * que l'identifiant laisserait rattacher un compte Instagram sous l'étiquette
 * Facebook.
 */
export function selectAttachable(
  available: readonly AvailableSubAccount[],
  requested: readonly string[]
): AvailableSubAccount[] {
  const demandés = new Set(requested)
  return available.filter((a) => demandés.has(cleDeSousCompte(a.platform, a.providerAccountId)))
}

/** Clé d'un sous-compte dans les formulaires : `plateforme:identifiant`. */
export function cleDeSousCompte(platform: string, providerAccountId: string): string {
  return `${platform}:${providerAccountId}`
}

/** Sépare une clé de formulaire. `null` si la forme n'est pas respectée. */
export function parseCleDeSousCompte(
  cle: string
): { platform: string; providerAccountId: string } | null {
  const sep = cle.indexOf(":")
  if (sep <= 0 || sep === cle.length - 1) return null
  return { platform: cle.slice(0, sep), providerAccountId: cle.slice(sep + 1) }
}
