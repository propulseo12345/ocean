// Décisions de traitement d'image — la moitié PURE, donc exécutable par les tests.
//
// POURQUOI CE FICHIER EST SÉPARÉ DE `image.ts`
// --------------------------------------------
// `image.ts` a besoin d'un canvas et d'un décodeur : il n'est atteignable par
// aucun test de `apps/web` (`node --test` sur `lib/**`). Tout ce qui DÉCIDE vit
// donc ici — quel format viser, quelle échelle, quel rectangle de recadrage,
// quelle taille de vignette — et `image.ts` ne fait qu'exécuter.
//
// Ce découpage est la leçon de la semaine : une règle écrite dans le composant
// qui l'applique est vraie « par lecture ». Une règle isolée ici est vraie par
// exécution, et une mutation la fait tomber.

import { IG_IMAGE_MAX_MB, IG_IMAGE_RATIO, REEL_MAX_MB } from "@/lib/specs"

/** Instagram n'accepte que du JPEG (règle 22). */
export const JPEG_MIME = "image/jpeg"
/** Vignettes : WebP, grand côté ~400 px (règle 20). */
export const THUMB_MIME = "image/webp"
export const THUMB_MAX_PX = 400
export const THUMB_QUALITY = 0.8

export const IG_IMAGE_MAX_BYTES = IG_IMAGE_MAX_MB * 1024 * 1024

/** Types acceptés par le bucket `media-originals` (022_media_storage.sql). */
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/heic", "image/heif"] as const
export const VIDEO_MIMES = ["video/mp4", "video/quicktime"] as const

/**
 * Un HEIC ne s'annonce pas toujours.
 *
 * Selon le navigateur et la façon dont la photo entre (Photos, Fichiers,
 * AirDrop), `File.type` vaut `image/heic`, `image/heif`, ou **la chaîne vide**.
 * Se fier au seul type MIME laisserait passer en « JPEG déjà conforme » un
 * fichier que Meta rejetterait : on regarde donc aussi l'extension.
 */
export function isHeic(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase()
  if (mime === "image/heic" || mime === "image/heif") return true
  if (mime.startsWith("image/") && mime !== "" && !mime.includes("hei")) return false
  return /\.(heic|heif)$/i.test(fileName)
}

export function isVideoFile(mimeType: string, fileName: string): boolean {
  if (mimeType.toLowerCase().startsWith("video/")) return true
  return /\.(mp4|mov|m4v)$/i.test(fileName)
}

/**
 * Ce fichier doit-il être transcodé avant d'entrer dans le Storage ?
 *
 * Tout ce qui n'est pas déjà du JPEG l'est : PNG et HEIC sont refusés par
 * Instagram (règle 22). La vidéo, elle, n'est jamais transcodée côté navigateur
 * — c'est le rôle du worker, et un MOV de 300 Mo ne passe pas par un canvas.
 */
export function needsJpegTranscode(mimeType: string, fileName: string): boolean {
  if (isVideoFile(mimeType, fileName)) return false
  return mimeType.toLowerCase() !== JPEG_MIME
}

export interface EncodeAttempt {
  quality: number
  /** Facteur d'échelle appliqué aux deux dimensions (1 = taille d'origine). */
  scale: number
}

/**
 * Échelle de repli pour passer sous les 8 Mo d'Instagram.
 *
 * On baisse d'abord la QUALITÉ à taille pleine (invisible à l'œil, et ça suffit
 * dans l'immense majorité des cas), et seulement ensuite les DIMENSIONS —
 * réduire un fichier de 12 Mo en le rendant plus petit qu'un écran serait un
 * mauvais échange. La liste est bornée : une boucle « tant que trop gros » sur
 * un navigateur mobile est un gel d'interface.
 */
export const ENCODE_ATTEMPTS: readonly EncodeAttempt[] = [
  { quality: 0.92, scale: 1 },
  { quality: 0.85, scale: 1 },
  { quality: 0.78, scale: 1 },
  { quality: 0.85, scale: 0.8 },
  { quality: 0.8, scale: 0.62 },
  { quality: 0.78, scale: 0.45 },
  { quality: 0.75, scale: 0.3 },
]

/** Dimensions entières d'une étape d'encodage, jamais nulles. */
export function scaledSize(
  width: number,
  height: number,
  scale: number
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Dimensions de la vignette : grand côté borné à 400 px, ratio conservé,
 * **jamais d'agrandissement** (une vignette plus grande que son original serait
 * plus lourde que lui pour rien).
 */
export function thumbDimensions(
  width: number,
  height: number,
  max: number = THUMB_MAX_PX
): { width: number; height: number } {
  const grandCôté = Math.max(width, height)
  if (grandCôté <= 0) return { width: 1, height: 1 }
  const facteur = Math.min(1, max / grandCôté)
  return scaledSize(width, height, facteur)
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Rectangle centré, le plus grand possible dans la source, au ratio demandé.
 *
 * « Cover » et pas « contain » : on ne veut pas de bandes noires dans un feed
 * Instagram. Le recadrage est donc destructif par construction — c'est pour ça
 * qu'il n'arrive JAMAIS tout seul, seulement quand l'utilisateur le demande
 * (cf. `applyCrop` et P5-9).
 *
 * ⚠ L'ARRONDI EST DIRECTIONNEL, ET CE N'EST PAS UN DÉTAIL
 * -------------------------------------------------------
 * Un `Math.round` naïf des deux côtés peut rendre un ratio INFÉRIEUR à la cible.
 * Sur 4:5 — qui est exactement `IG_IMAGE_RATIO.min` — « inférieur » veut dire
 * hors specs Instagram : on aurait produit, en recadrant pour se conformer, une
 * image que Meta refuse. C'est la propriété du test qui l'a trouvé (formes
 * 7×3 et 3×7 du balayage), pas une relecture.
 *
 * On arrondit donc toujours dans le sens qui ÉLARGIT le ratio obtenu :
 * `ceil` sur la largeur quand on rogne les côtés, `floor` sur la hauteur quand
 * on rogne le haut et le bas. Le ratio rendu est alors ≥ la cible par
 * construction, quelle que soit la taille de la source.
 */
export function centerCropRect(srcWidth: number, srcHeight: number, ratioCible: number): Rect {
  const ratioSource = srcWidth / srcHeight
  if (ratioSource > ratioCible) {
    // Trop large : on rogne à gauche et à droite. `ceil` ⇒ ratio obtenu ≥ cible.
    const width = Math.min(srcWidth, Math.max(1, Math.ceil(srcHeight * ratioCible)))
    return { x: Math.round((srcWidth - width) / 2), y: 0, width, height: srcHeight }
  }
  // Trop haut : on rogne en haut et en bas. `floor` ⇒ ratio obtenu ≥ cible.
  const height = Math.min(srcHeight, Math.max(1, Math.floor(srcWidth / ratioCible)))
  return { x: 0, y: Math.round((srcHeight - height) / 2), width: srcWidth, height }
}

export type CropPresetKey = "1:1" | "4:5" | "9:16"

export const CROP_RATIOS: Record<CropPresetKey, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
}

/** Dimensions cibles idéales d'un preset (CROP_TARGET_SIZES du composer). */
const CROP_LARGEUR_CIBLE = 1080

/**
 * Plan complet d'un recadrage : quel rectangle prendre dans la source, et à
 * quelles dimensions le rendre.
 *
 * La sortie n'est JAMAIS agrandie au-delà du rectangle disponible : produire un
 * 1080×1350 depuis un rectangle de 600×750 fabriquerait des pixels, donnerait
 * un fichier plus lourd, et ferait croire au preflight qu'on a une image haute
 * définition. C'est exactement la famille de mensonge que P5-4 a retirée.
 */
export function cropPlan(
  preset: CropPresetKey,
  srcWidth: number,
  srcHeight: number
): { rect: Rect; width: number; height: number } {
  const ratio = CROP_RATIOS[preset]
  const rect = centerCropRect(srcWidth, srcHeight, ratio)
  const width = Math.min(CROP_LARGEUR_CIBLE, rect.width)
  // Même arrondi directionnel qu'au-dessus (ratio obtenu ≥ cible), puis borné
  // par le rectangle disponible : la sortie ne fabrique jamais de pixels.
  const height = Math.min(rect.height, Math.max(1, Math.floor(width / ratio)))
  return { rect, width, height }
}

/** Le ratio est-il dans la fenêtre acceptée par Instagram (4:5 → 1.91:1) ? */
export function ratioWithinInstagram(width: number, height: number): boolean {
  const r = width / height
  return r >= IG_IMAGE_RATIO.min && r <= IG_IMAGE_RATIO.max
}

/**
 * Plafond de la SOURCE image, avant conversion.
 *
 * Ce n'est pas la limite Instagram (8 Mo, appliquée à la SORTIE par
 * `encodeJpeg`) : un HEIC de 5 Mo ou un PNG de 40 Mo sont des entrées
 * parfaitement légitimes qui produiront un JPEG conforme. La borne ici protège
 * d'autre chose — un canvas de plusieurs centaines de mégaoctets fait tomber
 * l'onglet, et sur mobile il le fait sans message.
 */
export const IMAGE_SOURCE_MAX_BYTES = 100 * 1024 * 1024
export const VIDEO_MAX_BYTES = REEL_MAX_MB * 1024 * 1024

export type UploadVerdict =
  | { ok: true; kind: "image"; targetMime: string }
  | { ok: true; kind: "video"; targetMime: string }
  | { ok: false; reason: "type_non_supporte" | "image_trop_grosse" | "video_trop_grosse" }

/**
 * Ce fichier peut-il entrer dans `media-originals` ?
 *
 * Le verdict est rendu AVANT tout transfert. C'est délibéré : le bucket porte
 * sa propre allowlist de types (022_media_storage.sql), mais elle se déclenche
 * côté serveur, donc après que l'utilisateur a payé le téléversement — et le
 * message qu'il reçoit alors est un code HTTP, pas une phrase.
 *
 * Le type MIME seul ne suffit pas : iOS livre régulièrement un `File.type` vide.
 * On retombe donc sur l'extension, comme `isHeic`.
 */
export function classifyUpload(
  mimeType: string,
  fileName: string,
  byteSize: number
): UploadVerdict {
  if (isVideoFile(mimeType, fileName)) {
    if (byteSize > VIDEO_MAX_BYTES) return { ok: false, reason: "video_trop_grosse" }
    const mime = mimeType.toLowerCase()
    return {
      ok: true,
      kind: "video",
      targetMime: mime === "video/mp4" || mime === "video/quicktime" ? mime : "video/mp4",
    }
  }

  const mime = mimeType.toLowerCase()
  const estImageConnue =
    (IMAGE_MIMES as readonly string[]).includes(mime) ||
    isHeic(mimeType, fileName) ||
    /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(fileName)
  if (!estImageConnue) return { ok: false, reason: "type_non_supporte" }
  if (byteSize > IMAGE_SOURCE_MAX_BYTES) return { ok: false, reason: "image_trop_grosse" }
  // Toute image ressort en JPEG : c'est le seul format qu'Instagram accepte, et
  // c'est aussi ce que le bucket autorise.
  return { ok: true, kind: "image", targetMime: JPEG_MIME }
}
