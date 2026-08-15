// Traitement d'image côté NAVIGATEUR — décodage, conversion JPEG, vignette WebP.
//
// Ce module exécute ; il ne décide pas. Toutes les règles (que transcoder, à
// quelle échelle, quel rectangle, quelle taille de vignette) vivent dans
// `image-plan.ts`, qui est exécuté par les tests. Ici, seulement du canvas.
//
// POURQUOI CÔTÉ CLIENT ET PAS DANS LE WORKER
// -------------------------------------------
// Un HEIC d'iPhone fait 2 à 5 Mo et Instagram le refuse (règle 22). Le convertir
// après téléversement voudrait dire transférer un fichier inutilisable, puis le
// retélécharger, le convertir, le réécrire — trois fois le trafic, sur un
// forfait mobile, pour un résultat identique. La conversion précède donc le
// transfert : ce qui entre dans `media-originals` est déjà publiable.

import {
  type CropPresetKey,
  cropPlan,
  ENCODE_ATTEMPTS,
  IG_IMAGE_MAX_BYTES,
  isHeic,
  JPEG_MIME,
  type Rect,
  scaledSize,
  THUMB_MIME,
  THUMB_QUALITY,
  thumbDimensions,
} from "./image-plan"

/**
 * Causes d'échec de préparation, sous forme de CODE et non de phrase.
 *
 * L'interface doit pouvoir dire à l'utilisateur s'il faut réessayer, changer de
 * fichier, ou se reconnecter. Une chaîne libre (« image encore 9 Mo… ») oblige
 * l'écran à faire de la reconnaissance de texte pour choisir son message, et
 * elle n'est traduisible dans aucune langue.
 */
export type MediaErrorCode =
  | "type_non_supporte"
  | "image_trop_grosse"
  | "video_trop_grosse"
  | "encore_trop_gros"
  | "decodage"
  | "canvas"

export class MediaDecodeError extends Error {
  readonly code: MediaErrorCode
  constructor(code: MediaErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = "MediaDecodeError"
    this.code = code
  }
}

export interface PreparedBlob {
  blob: Blob
  width: number
  height: number
  mimeType: string
}

/**
 * Décode un fichier image en bitmap.
 *
 * `imageOrientation: "from-image"` n'est pas cosmétique : une photo prise à
 * l'iPhone en mode portrait est stockée en paysage avec un tag EXIF
 * d'orientation. Sans cette option, le canvas la redresserait jamais et toutes
 * les photos verticales arriveraient couchées chez le client.
 *
 * Le HEIC passe d'abord par le décodeur natif — Safari sait le faire, et c'est
 * la cible prioritaire du produit — et retombe sur un décodeur WebAssembly
 * chargé À LA DEMANDE pour les navigateurs qui ne savent pas (Chrome, Firefox).
 * L'import dynamique garde ce WASM hors du bundle principal.
 */
export async function decodeImageFile(file: File): Promise<ImageBitmap> {
  const heic = isHeic(file.type, file.name)
  if (!heic) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch (err) {
      throw new MediaDecodeError("decodage", `${file.type || "type inconnu"}: ${String(err)}`)
    }
  }

  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    // Navigateur sans décodeur HEIC : on charge le décodeur logiciel.
  }
  try {
    const { heicTo } = await import("heic-to/next")
    return await heicTo({ blob: file, type: "bitmap" })
  } catch (err) {
    throw new MediaDecodeError("decodage", `HEIC: ${String(err)}`)
  }
}

interface Cible {
  width: number
  height: number
  /** Portion de la source à prendre. Absent = toute l'image. */
  rect?: Rect
}

/** Dessine `bitmap` (éventuellement rogné) aux dimensions demandées, puis encode. */
async function rendre(
  bitmap: ImageBitmap,
  cible: Cible,
  mimeType: string,
  quality: number
): Promise<Blob> {
  const { width, height } = cible
  const source: Rect = cible.rect ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new MediaDecodeError("canvas", "contexte 2d indisponible")
    ctx.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, width, height)
    return await canvas.convertToBlob({ type: mimeType, quality })
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new MediaDecodeError("canvas", "contexte 2d indisponible")
  ctx.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality)
  )
  if (!blob) throw new MediaDecodeError("canvas", "encodage impossible")
  return blob
}

/**
 * Produit le JPEG qui entrera dans `media-originals`.
 *
 * La descente en qualité puis en dimensions est BORNÉE (`ENCODE_ATTEMPTS`) : une
 * boucle « tant que c'est trop gros » sur un téléphone est un gel d'interface,
 * et un encodage JPEG de 12 Mpx coûte plusieurs centaines de millisecondes par
 * essai. Si aucun essai ne passe, on le dit — on ne téléverse pas un fichier
 * qu'Instagram refusera.
 */
export async function encodeJpeg(
  bitmap: ImageBitmap,
  options: { crop?: CropPresetKey; maxBytes?: number } = {}
): Promise<PreparedBlob> {
  const maxBytes = options.maxBytes ?? IG_IMAGE_MAX_BYTES

  // Le recadrage, s'il est demandé, fixe le rectangle source et les dimensions
  // de base ; sinon on part de l'image entière.
  const plan = options.crop ? cropPlan(options.crop, bitmap.width, bitmap.height) : null
  const rect = plan?.rect
  const baseWidth = plan?.width ?? bitmap.width
  const baseHeight = plan?.height ?? bitmap.height

  let dernier: PreparedBlob | null = null
  for (const essai of ENCODE_ATTEMPTS) {
    const { width, height } = scaledSize(baseWidth, baseHeight, essai.scale)
    const blob = await rendre(bitmap, { width, height, rect }, JPEG_MIME, essai.quality)
    dernier = { blob, width, height, mimeType: JPEG_MIME }
    if (blob.size <= maxBytes) return dernier
  }

  const taille = dernier ? Math.round(dernier.blob.size / 1024 / 1024) : 0
  throw new MediaDecodeError(
    "encore_trop_gros",
    `${taille} Mo après compression maximale (limite ${Math.round(maxBytes / 1024 / 1024)} Mo)`
  )
}

/**
 * Vignette WebP ~400 px destinée à `media-thumbs`.
 *
 * Le bucket est PUBLIC et plafonné à 1 Mo (022_media_storage.sql) : une vignette
 * qui dépasserait serait refusée par le Storage, pas par nous. À 400 px et
 * qualité 0,8, le WebP tourne autour de 20–40 Ko — la marge est confortable.
 */
export async function makeThumbnail(bitmap: ImageBitmap): Promise<PreparedBlob> {
  const { width, height } = thumbDimensions(bitmap.width, bitmap.height)
  const blob = await rendre(bitmap, { width, height }, THUMB_MIME, THUMB_QUALITY)
  return { blob, width, height, mimeType: THUMB_MIME }
}
