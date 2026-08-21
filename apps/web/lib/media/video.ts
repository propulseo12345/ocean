// Sonde vidéo côté navigateur : dimensions, durée, et vignette d'affiche.
//
// POURQUOI SONDER PLUTÔT QUE DE FAIRE CONFIANCE AU FICHIER
// --------------------------------------------------------
// `recordUploadedAsset` écrit `width`, `height` et `duration_ms`, et c'est sur
// ces trois valeurs que `lib/specs.ts` décide si un Reel est publiable (3 s à
// 15 min, 9:16). Les laisser à `null` reviendrait à faire passer n'importe
// quelle vidéo au preflight, jusqu'à ce que Meta la refuse — erreur permanente,
// `failed` direct sans retry (règle 18), sur le compte d'un vrai client. On les
// mesure donc à la source, dans le navigateur, avant tout transfert.
//
// La vidéo elle-même n'est JAMAIS transcodée ici : un MOV de 300 Mo ne passe pas
// par un canvas. Seule l'affiche (une image) est produite.

import { MediaDecodeError, type PreparedBlob } from "./image"
import { THUMB_MIME, THUMB_QUALITY, thumbDimensions } from "./image-plan"

export interface VideoProbe {
  width: number
  height: number
  durationMs: number
  /** Affiche WebP ~400 px. `null` si la frame n'a pas pu être lue. */
  thumb: PreparedBlob | null
}

const CHARGEMENT_MAX_MS = 20_000

function attendre<T>(
  video: HTMLVideoElement,
  événement: string,
  lire: () => T,
  libellé: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const minuteur = setTimeout(() => {
      nettoyer()
      reject(new MediaDecodeError("decodage", `vidéo (${libellé}) : délai dépassé`))
    }, CHARGEMENT_MAX_MS)

    function nettoyer() {
      clearTimeout(minuteur)
      video.removeEventListener(événement, onOk)
      video.removeEventListener("error", onKo)
    }
    function onOk() {
      nettoyer()
      resolve(lire())
    }
    function onKo() {
      nettoyer()
      reject(new MediaDecodeError("decodage", `vidéo (${libellé})`))
    }

    video.addEventListener(événement, onOk, { once: true })
    video.addEventListener("error", onKo, { once: true })
  })
}

async function dessinerAffiche(video: HTMLVideoElement): Promise<PreparedBlob | null> {
  const { width, height } = thumbDimensions(video.videoWidth, video.videoHeight)
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, width, height)
      const blob = await canvas.convertToBlob({ type: THUMB_MIME, quality: THUMB_QUALITY })
      return { blob, width, height, mimeType: THUMB_MIME }
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, THUMB_MIME, THUMB_QUALITY)
    )
    return blob ? { blob, width, height, mimeType: THUMB_MIME } : null
  } catch {
    // Une frame protégée ou un codec non dessinable ne doit pas empêcher le
    // téléversement : on repart sans affiche, la vidéo reste publiable.
    return null
  }
}

/**
 * Mesure une vidéo et en tire une affiche.
 *
 * L'affiche est prise un peu APRÈS le début (une première frame est très
 * souvent noire) mais jamais au-delà du milieu, pour rester représentative
 * même sur un clip très court.
 */
export async function probeVideo(file: File): Promise<VideoProbe> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.preload = "metadata"
  video.muted = true
  video.playsInline = true
  video.crossOrigin = "anonymous"
  video.src = url

  try {
    const meta = await attendre(
      video,
      "loadedmetadata",
      () => ({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      }),
      "métadonnées"
    )

    const durationMs =
      Number.isFinite(meta.duration) && meta.duration > 0 ? Math.round(meta.duration * 1000) : 0

    let thumb: PreparedBlob | null = null
    if (meta.width > 0 && meta.height > 0) {
      const instant = Math.min(0.1, Number.isFinite(meta.duration) ? meta.duration / 2 : 0.1)
      try {
        video.currentTime = instant
        await attendre(video, "seeked", () => true, "positionnement")
        thumb = await dessinerAffiche(video)
      } catch {
        thumb = null
      }
    }

    return { width: meta.width, height: meta.height, durationMs, thumb }
  } finally {
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(url)
  }
}
