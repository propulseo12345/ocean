import {
  isOutcomeUnknown,
  PermanentPublishError,
  type PublishJob,
  type PublishResult,
} from "../domain"
import type { FetchLike } from "../http"
import { graphCall } from "./meta/graph"
import type { ContainerStatus, PublishContext, Publisher } from "./types"

// Facebook Pages (Meta Graph). Trois flux, un par forme de contenu :
//
//   photo   : POST /{page-id}/photos (url, published=false) => photo_id, qui ne
//             publie RIEN ; puis POST /{page-id}/feed (message,
//             attached_media[i]) qui, lui, publie. Ce découpage n'est pas
//             cosmétique : il donne au flux photo un « conteneur » au sens de
//             la règle 15 — une étape réversible avant l'étape irréversible.
//   reel    : API Reels en trois temps (start -> upload -> finish). L'upload se
//             fait par `file_url` : Meta va chercher notre URL signée 48 h.
//   texte   : POST /{page-id}/feed (message) — AUCUN conteneur possible, voir
//             TEXT_ONLY_CONTAINER plus bas.
//
// LE QUOTA FACEBOOK SE LIT EN SORTIE D'APPEL, PAS AVANT — c'est contre-intuitif
// et c'est pour ça que ce module expose `onUsage`. Le BUC (4800 × utilisateurs
// engagés / 24 h) n'est pas calculable : Meta le renvoie dans l'en-tête
// `X-Business-Use-Case-Usage` de CHAQUE réponse. Il n'existe donc aucune sonde
// « avant le post » côté FB, contrairement à Instagram.

/**
 * Conteneur fictif d'un post SANS média.
 *
 * Un post texte n'a rien à préparer : le seul appel est celui qui publie. La
 * règle 15 n'a donc pas d'ancrage interrogeable, et il faut le DIRE plutôt que
 * de bricoler une réponse. Conséquence assumée : si l'on perd la main entre
 * `publish_started_at` et la réponse de Meta sur un post texte, le job finit en
 * `needs_verification` (024) — un humain regarde. C'est exactement ce pour quoi
 * ce statut a été créé : « on ne sait pas » vaut mieux qu'un doublon ou qu'un
 * faux échec.
 */
export const TEXT_ONLY_CONTAINER = "fb:text-only"

interface IdResponse {
  id?: string
  post_id?: string
}

interface ReelStartResponse {
  video_id?: string
  upload_url?: string
}

interface PhotoStatusResponse {
  id?: string
  page_story_id?: string
}

interface ReelStatusResponse {
  status?: { video_status?: string; processing_phase?: { status?: string } }
}

export interface FacebookDeps {
  fetch: FetchLike
  base?: string
}

/** `video_status` des Reels -> état Ocean. */
export function mapReelStatus(status: string | undefined): ContainerStatus {
  switch ((status ?? "").toLowerCase()) {
    case "published":
      return "published"
    case "ready":
      return "ready"
    case "processing":
    case "upload_complete":
      return "in_progress"
    case "error":
      return "error"
    case "expired":
      return "expired"
    default:
      return "in_progress"
  }
}

export function createFacebookPublisher(deps: FacebookDeps): Publisher {
  const call = async <T>(
    ctx: PublishContext,
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string | undefined>
  ) => {
    const res = await graphCall<T>(
      deps.fetch,
      { method, path, params, accessToken: ctx.accessToken, signal: ctx.signal },
      deps.base
    )
    // Le quota Page se relève ICI, en sortie : c'est la seule source. Le
    // publisher rend l'en-tête brut, il ne l'interprète pas.
    await ctx.reportUsage?.(res.headers.get("x-business-use-case-usage"))
    return res.data
  }

  const isReel = (ctx: PublishContext) => ctx.format === "reel" || ctx.media[0]?.kind === "video"

  return {
    async createContainer(_job: PublishJob, ctx: PublishContext) {
      if (ctx.media.length === 0) return { containerId: TEXT_ONLY_CONTAINER }

      if (isReel(ctx)) {
        const first = ctx.media[0]
        if (first?.kind !== "video") {
          throw new PermanentPublishError("facebook: un reel demande une video")
        }
        const started = await call<ReelStartResponse>(
          ctx,
          "POST",
          `${ctx.providerAccountId}/video_reels`,
          { upload_phase: "start" }
        )
        if (!started.video_id || !started.upload_url) {
          throw new Error("facebook: phase start sans video_id/upload_url")
        }
        // Upload « hosted file » : on donne l'URL signée, Meta va chercher les
        // octets. Rien n'est publié tant que la phase `finish` n'a pas eu lieu.
        const res = await deps.fetch(started.upload_url, {
          method: "POST",
          headers: {
            authorization: `OAuth ${ctx.accessToken}`,
            file_url: first.url,
          },
          signal: ctx.signal,
        })
        if (!res.ok) {
          // Un rupload en échec n'a rien publié : transitoire, on retentera.
          throw new Error(`facebook rupload HTTP ${res.status}`)
        }
        return { containerId: started.video_id }
      }

      // Photos : téléversées NON publiées. C'est ce qui donne une étape
      // réversible avant `/feed`, donc un vrai conteneur au sens de la règle 15.
      const ids: string[] = []
      for (const m of ctx.media) {
        const photo = await call<IdResponse>(ctx, "POST", `${ctx.providerAccountId}/photos`, {
          url: m.url,
          published: "false",
          alt_text_custom: m.altText ?? undefined,
        })
        if (!photo.id) throw new Error("facebook: photo sans id")
        ids.push(photo.id)
      }
      // Plusieurs photos = un seul post à pièces jointes. L'ordre est celui de
      // content_media, comme le carrousel Instagram.
      return { containerId: ids.join(",") }
    },

    async publish(_job: PublishJob, containerId: string, ctx: PublishContext) {
      if (containerId === TEXT_ONLY_CONTAINER) {
        const post = await call<IdResponse>(ctx, "POST", `${ctx.providerAccountId}/feed`, {
          message: ctx.caption || undefined,
        })
        return toResult(post.id)
      }

      if (isReel(ctx)) {
        const done = await call<IdResponse>(ctx, "POST", `${ctx.providerAccountId}/video_reels`, {
          upload_phase: "finish",
          video_id: containerId,
          video_state: "PUBLISHED",
          description: ctx.caption || undefined,
        })
        return toResult(done.post_id ?? done.id ?? containerId)
      }

      const params: Record<string, string | undefined> = { message: ctx.caption || undefined }
      containerId.split(",").forEach((id, i) => {
        params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
      })
      const post = await call<IdResponse>(ctx, "POST", `${ctx.providerAccountId}/feed`, params)
      return toResult(post.post_id ?? post.id)
    },

    /**
     * La question posée n'est PAS la même selon l'état du job, et le prétendre
     * serait le bug :
     *   - job frais (aucune ancre) : « puis-je publier ce conteneur ? » ;
     *   - reprise (ancre posée)    : « ce conteneur a-t-il DÉJÀ publié ? ».
     * Meta répond aux deux avec un seul champ côté Instagram ; côté Facebook,
     * il faut les distinguer à la main.
     */
    async getContainerStatus(job: PublishJob, containerId: string, ctx: PublishContext) {
      const recovery = isOutcomeUnknown(job)

      if (containerId === TEXT_ONLY_CONTAINER) {
        // Frais : rien n'est parti, le conteneur fictif est « prêt ».
        if (!recovery) return "ready"
        // Reprise : indécidable. On le dit — `failPermanent` avec l'ancre posée
        // écrit `needs_verification`, pas `failed` (024). Republier à l'aveugle
        // un post texte serait le doublon ; le déclarer échoué serait le
        // mensonge qui produit le doublon dès que l'admin reprogramme.
        throw new PermanentPublishError(
          "facebook: post sans media, publication non verifiable — verification humaine requise"
        )
      }

      if (isReel(ctx)) {
        const res = await call<ReelStatusResponse>(ctx, "GET", containerId, { fields: "status" })
        return mapReelStatus(res.status?.video_status)
      }

      // Photos non publiées : `page_story_id` n'apparaît QUE lorsque la photo a
      // rejoint un post du fil. C'est notre preuve de publication.
      const first = containerId.split(",")[0] as string
      const photo = await call<PhotoStatusResponse>(ctx, "GET", first, {
        fields: "id,page_story_id",
      })
      return photo.page_story_id ? "published" : "ready"
    },

    async resolvePublished(_job: PublishJob, containerId: string, ctx: PublishContext) {
      if (isReel(ctx)) return toResult(containerId)
      const first = containerId.split(",")[0] as string
      const photo = await call<PhotoStatusResponse>(ctx, "GET", first, { fields: "page_story_id" })
      return toResult(photo.page_story_id ?? first)
    },
  }

  function toResult(postId: string | undefined): PublishResult {
    if (!postId) throw new Error("facebook: publication sans identifiant de post")
    return {
      externalPostId: postId,
      // Le permalien d'un post de Page se déduit de son id : Meta ne renvoie
      // pas de `permalink_url` sur toutes les formes de publication.
      permalink: `https://www.facebook.com/${postId.replace("_", "/posts/")}`,
      targetStatus: "published",
    }
  }
}
