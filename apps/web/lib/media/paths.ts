// Chemins de stockage des médias (règle 21) — la convention, en un seul endroit.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Le chemin n'est pas cosmétique : c'est le **mécanisme d'isolation**. Les
// policies `storage.objects` lisent `(storage.foldername(name))[1]` et `[2]`
// comme l'org et le client, et `private.can_write_client_media` couple les deux
// — un membre de l'org A ne peut pas écrire dans `{orgA}/{clientDeOrgB}/`. Un
// chemin construit à la main quelque part dans un composant, et l'isolation
// devient une convention orale.
//
// LA DIVERGENCE ASSUMÉE AVEC CLAUDE.md §21
// ----------------------------------------
// La règle écrit `{org_id}/{client_id}/{content_item_id}/{media_asset_id}/…`.
// Ce n'est **pas applicable**, pour deux raisons indépendantes :
//
//   1. `media_asset_id` est généré par l'INSERT (`gen_random_uuid()`), et
//      `recordUploadedAsset` n'est appelée qu'APRÈS le téléversement. Le
//      navigateur ne peut donc pas connaître cet id au moment où il choisit le
//      chemin. Un chemin qui le contiendrait est un vœu pieux.
//   2. `content_item_id` n'existe pas non plus : un média de médiathèque n'est
//      rattaché à aucun contenu (`recordUploadedAsset` ne prend même pas ce
//      paramètre), et un asset peut ensuite être attaché à plusieurs contenus
//      puis détaché. Mettre l'un d'eux dans le chemin figerait un lien qui,
//      lui, est mobile.
//
// La convention retenue garde ce qui compte — l'isolation de tenant sur les deux
// premiers segments — et remplace le reste par une **clé d'upload** tirée au
// hasard côté client :
//
//     {org_id}/{client_id}/{upload_key}/{nom_de_fichier}
//
// La résolution « quel asset est cet objet ? » ne passe donc PAS par le chemin :
// elle passe par `media_assets.storage_path`, qui porte un index UNIQUE
// (012:65). C'est ce que fait `private.can_read_client_media` (migration 033).

/** Buckets — `media-originals` est PRIVÉ, `media-thumbs` est public (règle 20). */
export const ORIGINALS_BUCKET = "media-originals"
export const THUMBS_BUCKET = "media-thumbs"

/** Longueur max d'un nom de fichier conservé dans le chemin. */
const NOM_MAX = 96

/**
 * Assainit un nom de fichier pour qu'il puisse vivre dans une clé S3S.
 *
 * Storage accepte beaucoup de choses, mais un nom qui contient `/` créerait un
 * segment de plus — donc décalerait `foldername()[1]` et `[2]`, c'est-à-dire
 * **l'isolation de tenant**. Ce n'est pas de la cosmétique.
 */
export function sanitizeFileName(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+/g, "-")
    .slice(0, NOM_MAX)
    .replace(/[-.]+$/, "")

  return base || "fichier"
}

/** Extension en minuscules, sans point. Vide si le nom n'en porte pas. */
export function fileExtension(nom: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(nom)
  return m ? m[1].toLowerCase() : ""
}

/**
 * Remplace l'extension d'un nom de fichier (conversion JPEG, vignette WebP).
 * Un nom sans extension en reçoit une.
 */
export function withExtension(nom: string, ext: string): string {
  const sansExt = nom.replace(/\.[a-zA-Z0-9]+$/, "")
  return `${sansExt}.${ext}`
}

export type MediaPathParts = {
  orgId: string
  clientId: string
  uploadKey: string
  fileName: string
}

/**
 * Chemin de l'ORIGINAL dans `media-originals`.
 *
 * `uploadKey` doit être unique par fichier (un `crypto.randomUUID()` côté
 * client) : c'est lui qui évite qu'un second envoi du même nom écrase le
 * premier — `media_assets.storage_path` étant UNIQUE, une collision ferait
 * échouer l'enregistrement après un téléversement déjà payé.
 */
export function originalPath(parts: MediaPathParts): string {
  return `${parts.orgId}/${parts.clientId}/${parts.uploadKey}/${sanitizeFileName(parts.fileName)}`
}

/**
 * Chemin de la VIGNETTE dans `media-thumbs`, toujours en `.webp`.
 *
 * Même préfixe `{org}/{client}/{key}` que l'original : les policies du bucket
 * `media-thumbs` lisent les deux mêmes segments, donc l'isolation est identique,
 * et les deux objets d'un même média restent voisins pour la purge.
 */
export function thumbPath(parts: MediaPathParts): string {
  const nom = withExtension(sanitizeFileName(parts.fileName), "webp")
  return `${parts.orgId}/${parts.clientId}/${parts.uploadKey}/${nom}`
}

/**
 * Relit les deux segments d'isolation d'un chemin.
 *
 * Utile côté serveur pour recouper qu'un chemin fourni par le navigateur vise
 * bien le tenant attendu — défense en profondeur, la policy tranchant de toute
 * façon.
 */
export function tenantOf(path: string): { orgId: string; clientId: string } | null {
  const segments = path.split("/")
  if (segments.length < 4) return null
  const [orgId, clientId] = segments
  if (!orgId || !clientId) return null
  return { orgId, clientId }
}
