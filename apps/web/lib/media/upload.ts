// Orchestration d'un téléversement : préparer → transférer → vignette → enregistrer.
//
// L'ORDRE DES OPÉRATIONS — LA DÉCISION DU LOT
// --------------------------------------------
// Le `media_asset_id` est généré par l'INSERT ; le navigateur ne peut donc pas
// le connaître au moment où il téléverse. Il fallait choisir un sens, et c'est
// **TRANSFERT D'ABORD, INSERT ENSUITE**, avec un chemin porté par une clé
// d'upload tirée côté client (`{org}/{client}/{upload_key}/{fichier}`).
//
// Le motif tient en une phrase : les deux modes de défaillance ne se valent pas.
//   · INSERT d'abord → toute coupure laisse une ligne `media_assets` qui désigne
//     un objet inexistant. Elle s'affiche dans la médiathèque, produit un cadre
//     vide dans le studio et le portail, et il faut inventer un état « en
//     attente » plus un balayeur pour la rattraper.
//   · Transfert d'abord → au pire un objet Storage sans ligne. Invisible pour
//     l'app, et c'est exactement ce que la Edge Function `media-cleanup`
//     (règle 23) est faite pour balayer.
// Un déchet invisible contre un mensonge visible : ce produit ne peut pas se
// permettre le second.
//
// Ce sens est aussi celui que `paths.ts` fixe depuis P5-5, celui que la
// migration 033 suppose (elle résout l'objet par `media_assets.storage_path`,
// index UNIQUE, et non par un segment du chemin), et celui que `pathBelongsTo`
// recoupe dans `recordUploadedAsset`.

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ActionResult } from "@/lib/actions/_helpers"
import type { Database } from "@/lib/supabase/types"
import { decodeImageFile, encodeJpeg, MediaDecodeError, makeThumbnail } from "./image"
import { type CropPresetKey, classifyUpload } from "./image-plan"
import {
  ORIGINALS_BUCKET,
  originalPath,
  sanitizeFileName,
  THUMBS_BUCKET,
  thumbPath,
  withExtension,
} from "./paths"
import { TusAbortError, uploadResumable } from "./tus"
import { probeVideo } from "./video"

export type UploadPhase = "preparation" | "transfert" | "vignette" | "enregistrement"

export interface UploadState {
  phase: UploadPhase
  /** Octets transférés / total, pour la barre de progression. */
  sent: number
  total: number
}

export interface UploadedAsset {
  assetId: string
  storagePath: string
  thumbPath: string | null
  type: "image" | "video"
  width: number
  height: number
  byteSize: number
  mimeType: string
  durationMs: number | null
  fileName: string
  /** URL publique de la vignette (bucket public). Vide si pas de vignette. */
  thumbUrl: string
  /** URL signée de l'original, repli sur la vignette. Jamais stockée. */
  fullUrl: string
}

/** Même TTL que `content-media.ts` et `pro.ts` : une heure. */
const SIGNED_URL_TTL = 3600

export type UploadOutcome =
  | { ok: true; asset: UploadedAsset }
  | { ok: false; error: string; annulé?: boolean }

export interface UploadDeps {
  supabase: SupabaseClient<Database>
  supabaseUrl: string
  anonKey: string
  /** `recordUploadedAsset`, injectée : ce module ne dépend pas de "use server". */
  record: (input: unknown) => Promise<ActionResult<{ id: string }>>
}

export interface UploadInput {
  file: File
  orgId: string
  clientId: string
  crop?: CropPresetKey
  onState?: (state: UploadState) => void
  signal?: AbortSignal
}

interface Préparé {
  type: "image" | "video"
  blob: Blob
  mimeType: string
  width: number
  height: number
  durationMs: number | null
  thumb: { blob: Blob; mimeType: string } | null
  /** Nom de fichier APRÈS conversion (un HEIC converti finit en `.jpg`). */
  fileName: string
}

/**
 * Prépare le fichier : conversion JPEG pour les images (règle 22), mesure et
 * affiche pour les vidéos. Rien n'est transféré ici.
 */
async function préparer(input: UploadInput): Promise<Préparé> {
  const { file } = input
  const verdict = classifyUpload(file.type, file.name, file.size)
  if (!verdict.ok) throw new MediaDecodeError(verdict.reason)

  if (verdict.kind === "video") {
    const sonde = await probeVideo(file)
    return {
      type: "video",
      blob: file,
      mimeType: verdict.targetMime,
      width: sonde.width,
      height: sonde.height,
      durationMs: sonde.durationMs > 0 ? sonde.durationMs : null,
      thumb: sonde.thumb ? { blob: sonde.thumb.blob, mimeType: sonde.thumb.mimeType } : null,
      fileName: sanitizeFileName(file.name),
    }
  }

  // Un seul décodage sert au JPEG et à la vignette : décoder deux fois un HEIC
  // de 12 Mpx doublerait l'attente pour un résultat identique.
  const bitmap = await decodeImageFile(file)
  try {
    const jpeg = await encodeJpeg(bitmap, { crop: input.crop })
    const vignette = await makeThumbnail(bitmap)
    return {
      type: "image",
      blob: jpeg.blob,
      mimeType: jpeg.mimeType,
      width: jpeg.width,
      height: jpeg.height,
      durationMs: null,
      thumb: { blob: vignette.blob, mimeType: vignette.mimeType },
      // L'extension SUIT le contenu : un `.heic` qui contient du JPEG est un
      // piège pour tout ce qui lit le chemin, à commencer par le worker.
      fileName: withExtension(sanitizeFileName(file.name), "jpg"),
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Téléverse un fichier et l'enregistre en base.
 *
 * Si l'enregistrement échoue APRÈS le transfert, l'objet reste dans le Storage
 * sans ligne correspondante. C'est assumé : `media-originals` n'a volontairement
 * aucune policy DELETE (règle 23), le navigateur ne peut donc pas nettoyer, et
 * un orphelin invisible vaut mieux qu'une ligne qui pointe dans le vide.
 */
export async function uploadMediaFile(
  deps: UploadDeps,
  input: UploadInput
): Promise<UploadOutcome> {
  const { onState, signal } = input
  try {
    onState?.({ phase: "preparation", sent: 0, total: input.file.size })
    const prêt = await préparer(input)

    const uploadKey = crypto.randomUUID()
    const parts = {
      orgId: input.orgId,
      clientId: input.clientId,
      uploadKey,
      fileName: prêt.fileName,
    }
    const cheminOriginal = originalPath(parts)
    const cheminVignette = prêt.thumb ? thumbPath(parts) : null

    const { data: session } = await deps.supabase.auth.getSession()
    const accessToken = session.session?.access_token
    if (!accessToken) return { ok: false, error: "session_expiree" }

    onState?.({ phase: "transfert", sent: 0, total: prêt.blob.size })
    await uploadResumable({
      endpoint: `${deps.supabaseUrl}/storage/v1/upload/resumable`,
      bucket: ORIGINALS_BUCKET,
      objectName: cheminOriginal,
      blob: prêt.blob,
      contentType: prêt.mimeType,
      accessToken,
      apiKey: deps.anonKey,
      signal,
      onProgress: (sent, total) => onState?.({ phase: "transfert", sent, total }),
    })

    if (prêt.thumb && cheminVignette) {
      onState?.({ phase: "vignette", sent: prêt.blob.size, total: prêt.blob.size })
      // Vignette : quelques dizaines de Ko, un POST simple suffit — TUS ne sert
      // qu'à rendre reprenable ce qui est long.
      const { error } = await deps.supabase.storage
        .from(THUMBS_BUCKET)
        .upload(cheminVignette, prêt.thumb.blob, { contentType: prêt.thumb.mimeType })
      if (error) return { ok: false, error: "thumb_refusee" }
    }

    onState?.({ phase: "enregistrement", sent: prêt.blob.size, total: prêt.blob.size })
    const res = await deps.record({
      clientId: input.clientId,
      type: prêt.type,
      storagePath: cheminOriginal,
      thumbPath: cheminVignette,
      mimeType: prêt.mimeType,
      byteSize: prêt.blob.size,
      width: prêt.width > 0 ? prêt.width : null,
      height: prêt.height > 0 ? prêt.height : null,
      durationMs: prêt.durationMs,
      fileName: prêt.fileName,
      source: "upload",
    })
    if (!res.ok) return { ok: false, error: res.error }
    if (!res.data) return { ok: false, error: "db_error" }

    // Les URL sont dérivées ICI, jamais stockées (règle 20). Sans elles, la
    // seule façon d'afficher le média fraîchement déposé serait de recharger la
    // page — donc de perdre le brouillon en cours dans le composer.
    const thumbUrl = cheminVignette
      ? deps.supabase.storage.from(THUMBS_BUCKET).getPublicUrl(cheminVignette).data.publicUrl
      : ""
    const { data: signé } = await deps.supabase.storage
      .from(ORIGINALS_BUCKET)
      .createSignedUrl(cheminOriginal, SIGNED_URL_TTL)

    return {
      ok: true,
      asset: {
        assetId: res.data.id,
        storagePath: cheminOriginal,
        thumbPath: cheminVignette,
        type: prêt.type,
        width: prêt.width,
        height: prêt.height,
        byteSize: prêt.blob.size,
        mimeType: prêt.mimeType,
        durationMs: prêt.durationMs,
        fileName: prêt.fileName,
        thumbUrl,
        // Repli sur la vignette : un original non signable ne doit pas produire
        // une tuile vide — même règle que `makeMediaUrlResolver` (P5-10).
        fullUrl: signé?.signedUrl ?? thumbUrl,
      },
    }
  } catch (err) {
    if (err instanceof TusAbortError) return { ok: false, error: "annule", annulé: true }
    if (err instanceof MediaDecodeError) return { ok: false, error: err.code }
    return { ok: false, error: "upload_echec" }
  }
}
