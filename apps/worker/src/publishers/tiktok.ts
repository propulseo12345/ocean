import {
  isOutcomeUnknown,
  PermanentPublishError,
  type PublishJob,
  type PublishResult,
} from "../domain"
import { type FetchLike, redactSecrets, truncateBody } from "../http"
import type { ContainerStatus, PublishContext, Publisher } from "./types"

// TikTok = BROUILLON, jamais une publication (scope `video.upload`). La vidéo
// arrive dans la boîte de réception du créateur, qui finit le post lui-même :
// statut métier `pushed_to_platform`, et non `published`.
//
// FILE_UPLOAD CHUNKÉ DEPUIS LE WORKER — JAMAIS PULL_FROM_URL
// -----------------------------------------------------------
// L'anti-pattern est explicite (CLAUDE.md §5) : `PULL_FROM_URL` exige un domaine
// vérifié chez TikTok, et `*.supabase.co` ne peut pas l'être (il ne nous
// appartient pas). Le worker télécharge donc la vidéo par tranches depuis
// l'URL signée et les repousse vers `upload_url` : les octets transitent, mais
// jamais l'URL.
//
// L'ORDRE RESPECTE LA RÈGLE 15, ET CE N'EST PAS GRATUIT
// ------------------------------------------------------
//   createContainer = INIT SEUL. Il réserve un `publish_id` et une `upload_url`
//   et ne crée RIEN dans le compte du créateur — étape réversible.
//   publish        = LE TRANSFERT. C'est lui qui fait apparaître le brouillon,
//   donc l'étape irréversible, donc celle qui doit suivre `publish_started_at`.
// Mettre le transfert dans `createContainer` aurait rendu le brouillon visible
// AVANT que l'ancre soit posée : un crash à cet instant produirait un second
// brouillon à la tentative suivante, et brûlerait le quota de 5 / 24 h.
//
// L'`upload_url` N'EST JAMAIS PERSISTÉE : elle porte un jeton, et
// `content_targets.external_container_id` est lisible par les membres de l'org
// (règle 11 — aucun secret vers le navigateur). Elle vit en mémoire du process ;
// si le worker redémarre, la reprise interroge `status/fetch` et repart d'un
// init neuf plutôt que de deviner.

const TIKTOK_BASE = "https://open.tiktokapis.com/v2"

/** 10 Mio. TikTok exige des tranches de 5 à 64 Mio ; la dernière absorbe le reste. */
export const TIKTOK_CHUNK_SIZE = 10 * 1024 * 1024

/** Au-delà, TikTok refuse le fichier — inutile de transférer 300 Mo pour rien. */
const TIKTOK_MAX_BYTES = 4 * 1024 * 1024 * 1024

interface InitResponse {
  data?: { publish_id?: string; upload_url?: string }
  error?: { code?: string; message?: string }
}

interface StatusResponse {
  data?: { status?: string; fail_reason?: string }
  error?: { code?: string; message?: string }
}

/**
 * Découpe conforme à TikTok : `total_chunk_count = floor(taille / chunk)`, et la
 * DERNIÈRE tranche emporte le reliquat. Un `ceil` produirait une tranche finale
 * de quelques kilo-octets, que l'API refuse (minimum 5 Mio hors fichier unique).
 */
export function planChunks(byteSize: number, chunkSize = TIKTOK_CHUNK_SIZE) {
  if (byteSize <= 0) throw new PermanentPublishError("tiktok: taille de video inconnue ou nulle")
  if (byteSize > TIKTOK_MAX_BYTES) {
    throw new PermanentPublishError(`tiktok: video de ${byteSize} octets, au-dela de la limite`)
  }
  if (byteSize <= chunkSize) return [{ start: 0, end: byteSize - 1 }]
  const count = Math.floor(byteSize / chunkSize)
  return Array.from({ length: count }, (_, i) => ({
    start: i * chunkSize,
    end: i === count - 1 ? byteSize - 1 : (i + 1) * chunkSize - 1,
  }))
}

/** `status` de status/fetch -> état Ocean. */
export function mapTikTokStatus(status: string | undefined): ContainerStatus {
  switch ((status ?? "").toUpperCase()) {
    // Le brouillon EXISTE dans la boîte du créateur : ne surtout pas recommencer
    // (il compte dans les 5 brouillons / 24 h).
    case "PUBLISH_COMPLETE":
    case "SEND_TO_USER_INBOX":
      return "published"
    case "PROCESSING_UPLOAD":
    case "PROCESSING_DOWNLOAD":
      return "in_progress"
    case "FAILED":
      return "error"
    default:
      return "in_progress"
  }
}

export interface TikTokDeps {
  fetch: FetchLike
  base?: string
  chunkSize?: number
}

export function createTikTokPublisher(deps: TikTokDeps): Publisher {
  const base = deps.base ?? TIKTOK_BASE
  const chunkSize = deps.chunkSize ?? TIKTOK_CHUNK_SIZE
  /** publish_id -> upload_url. Volatil À DESSEIN (voir l'en-tête). */
  const uploads = new Map<string, string>()

  async function post<T>(ctx: PublishContext, path: string, body: unknown): Promise<T> {
    const res = await deps.fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ctx.accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
      signal: ctx.signal,
    })
    const raw = truncateBody(redactSecrets(await res.text(), [ctx.accessToken]))
    if (!res.ok) throw new Error(`tiktok ${path} HTTP ${res.status}: ${raw}`)
    const parsed = JSON.parse(raw) as { error?: { code?: string; message?: string } }
    // TikTok répond 200 avec `error.code = "ok"` en cas de succès : tout autre
    // code est un échec, et le lire est la seule façon de ne pas écrire un
    // `publish_id` undefined en base.
    const code = parsed.error?.code
    if (code && code !== "ok") {
      const message = `tiktok ${path}: ${code} — ${parsed.error?.message ?? ""}`
      // `spam_risk_*` et `invalid_param` ne s'améliorent pas en réessayant.
      if (code.startsWith("spam_risk") || code === "invalid_param" || code === "url_ownership_unverified") {
        throw new PermanentPublishError(message)
      }
      throw new Error(message)
    }
    return parsed as T
  }

  return {
    async createContainer(_job: PublishJob, ctx: PublishContext) {
      const video = ctx.media[0]
      if (!video || video.kind !== "video") {
        throw new PermanentPublishError("tiktok: une video est requise (brouillon video.upload)")
      }
      const size = video.byteSize
      if (!size) throw new PermanentPublishError("tiktok: taille de la video inconnue")
      const chunks = planChunks(size, chunkSize)

      const init = await post<InitResponse>(ctx, "/post/publish/inbox/video/init/", {
        source_info: {
          source: "FILE_UPLOAD",
          video_size: size,
          chunk_size: chunks.length === 1 ? size : chunkSize,
          total_chunk_count: chunks.length,
        },
      })
      const publishId = init.data?.publish_id
      const uploadUrl = init.data?.upload_url
      if (!publishId || !uploadUrl) throw new Error("tiktok: init sans publish_id/upload_url")
      uploads.set(publishId, uploadUrl)
      return { containerId: publishId }
    },

    /** L'étape irréversible : le transfert fait apparaître le brouillon. */
    async publish(_job: PublishJob, containerId: string, ctx: PublishContext) {
      const uploadUrl = uploads.get(containerId)
      const video = ctx.media[0]
      if (!video?.byteSize) throw new PermanentPublishError("tiktok: taille de la video inconnue")
      if (!uploadUrl) {
        // Le process a redémarré entre l'init et le transfert. On ne peut plus
        // téléverser vers ce publish_id, et en inventer un ici publierait sous
        // une identité que le job ne connaît pas. On rend la main : la reprise
        // interrogera status/fetch, constatera qu'aucun brouillon n'existe, et
        // repartira d'un init neuf.
        throw new Error(`tiktok: upload_url perdue pour ${containerId} (redemarrage du worker)`)
      }

      for (const { start, end } of planChunks(video.byteSize, chunkSize)) {
        const part = await fetchRange(deps.fetch, video.url, start, end, ctx.signal)
        const res = await deps.fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "content-type": video.mimeType ?? "video/mp4",
            "content-length": String(part.byteLength),
            "content-range": `bytes ${start}-${end}/${video.byteSize}`,
          },
          body: part,
          signal: ctx.signal,
        })
        if (!res.ok) throw new Error(`tiktok upload HTTP ${res.status} (tranche ${start}-${end})`)
      }
      uploads.delete(containerId)

      return {
        externalPostId: containerId,
        // Aucun permalien : le brouillon n'a pas d'URL publique tant que le
        // créateur ne l'a pas finalisé. En inventer une afficherait un lien
        // mort au client.
        targetStatus: "pushed_to_platform",
      } satisfies PublishResult
    },

    async getContainerStatus(job: PublishJob, containerId: string, ctx: PublishContext) {
      // Job frais : la seule question est « puis-je transférer ? », et la
      // réponse tient à la présence de l'upload_url en mémoire. Interroger
      // status/fetch ici rendrait PROCESSING_UPLOAD sur un init tout neuf, donc
      // `awaiting_media`, donc un transfert qui n'aurait jamais lieu.
      if (!isOutcomeUnknown(job)) return uploads.has(containerId) ? "ready" : "error"

      const res = await post<StatusResponse>(ctx, "/post/publish/status/fetch/", {
        publish_id: containerId,
      })
      return mapTikTokStatus(res.data?.status)
    },

    async resolvePublished(_job: PublishJob, containerId: string) {
      return {
        externalPostId: containerId,
        targetStatus: "pushed_to_platform",
      } satisfies PublishResult
    },
  }
}

/**
 * Lit UNE tranche du fichier source. Le `Range` est ce qui évite de charger
 * 300 Mo en mémoire : un Reel entier dans le tas d'un worker à un replica
 * suffit à le faire tomber, et il traite les jobs en série.
 */
async function fetchRange(
  fetchImpl: FetchLike,
  url: string,
  start: number,
  end: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const res = await fetchImpl(url, { headers: { range: `bytes=${start}-${end}` }, signal })
  if (!res.ok) throw new Error(`lecture du media HTTP ${res.status} (tranche ${start}-${end})`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const expected = end - start + 1
  if (buf.byteLength !== expected) {
    // Un Storage qui ignore l'en-tête Range renverrait le fichier entier : sans
    // ce test, on téléverserait N fois la vidéo complète, et TikTok recevrait
    // un fichier corrompu sans que rien ne le signale.
    throw new Error(`tranche ${start}-${end}: ${buf.byteLength} octets recus, ${expected} attendus`)
  }
  return buf
}
