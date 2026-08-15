import { PermanentPublishError, type PublishJob, type PublishResult } from "../domain"
import type { FetchLike } from "../http"
import type { JobMedia } from "../media/signed-urls"
import { graphCall } from "./meta/graph"
import type { ContainerStatus, PublishContext, Publisher } from "./types"

// Instagram — Meta Graph API, Standard Access. Le flux réel, en trois temps :
//
//   1. createContainer : POST /{ig-user-id}/media
//        image     -> image_url (JPEG signé 48 h), caption
//        reel      -> media_type=REELS, video_url, caption
//        carrousel -> N conteneurs enfants (is_carousel_item=true), puis un
//                     conteneur parent media_type=CAROUSEL, children=id1,id2,…
//        story     -> media_type=STORIES
//      => renvoie {id}, le creation_id.
//   2. getContainerStatus : GET /{creation_id}?fields=status_code,status
//      C'est le moteur qui attend (état `awaiting_media`), pas ce module : un
//      sleep ici gèlerait la file entière, qui est séquentielle.
//   3. publish : POST /{ig-user-id}/media_publish?creation_id=…
//
// Le transport est INJECTÉ. Aucun `fetch` global : c'est la seule façon de
// vérifier ce dialogue sans app Meta, et donc la seule façon de le livrer
// autrement qu'en pariant.
//
// `ctx.signal` est transmis à CHAQUE appel : sans lui, le timeout du moteur rend
// la main mais la requête continue de vivre en tâche de fond, socket et token
// compris (types.ts:20-27).

interface CreateResponse {
  id?: string
}

interface StatusResponse {
  status_code?: string
  status?: string
  id?: string
}

interface PublishedResponse {
  id?: string
  permalink?: string
}

/** `status_code` Meta -> état Ocean. Voir ContainerStatus pour FINISHED/PUBLISHED. */
export function mapStatusCode(code: string | undefined): ContainerStatus {
  switch ((code ?? "").toUpperCase()) {
    case "PUBLISHED":
      return "published"
    case "FINISHED":
      return "ready"
    case "IN_PROGRESS":
      return "in_progress"
    case "EXPIRED":
      return "expired"
    case "ERROR":
      return "error"
    default:
      // Un code inconnu n'est PAS traité comme « prêt » : publier sur une
      // supposition est le seul geste irréversible de tout ce module.
      return "in_progress"
  }
}

/**
 * Un contenu Instagram doit avoir un média, et un carrousel entre 2 et 10.
 * Refuser ici, avec un message clair, vaut mieux qu'un code 100 de Meta trois
 * secondes plus tard — et c'est un échec PERMANENT : aucune tentative ne fera
 * apparaître un média que le contenu n'a pas.
 */
export function validateInstagramMedia(media: JobMedia[], format: string): void {
  if (media.length === 0) {
    throw new PermanentPublishError("instagram: aucun media (Instagram refuse un post sans media)")
  }
  if (format === "carousel" && (media.length < 2 || media.length > 10)) {
    throw new PermanentPublishError(
      `instagram: un carrousel demande 2 a 10 medias, ${media.length} fourni(s)`
    )
  }
  if (format === "reel" && media[0]?.kind !== "video") {
    throw new PermanentPublishError("instagram: un reel demande une video")
  }
}

function mediaParams(m: JobMedia): Record<string, string> {
  return m.kind === "video" ? { video_url: m.url } : { image_url: m.url }
}

export interface InstagramDeps {
  fetch: FetchLike
  /** Base Graph, surchargée par les tests. */
  base?: string
}

export function createInstagramPublisher(deps: InstagramDeps): Publisher {
  const call = <T>(
    ctx: PublishContext,
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string | undefined>
  ) =>
    graphCall<T>(
      deps.fetch,
      { method, path, params, accessToken: ctx.accessToken, signal: ctx.signal },
      deps.base
    )

  async function createChild(ctx: PublishContext, m: JobMedia): Promise<string> {
    const { data } = await call<CreateResponse>(ctx, "POST", `${ctx.providerAccountId}/media`, {
      ...mediaParams(m),
      is_carousel_item: "true",
      ...(m.kind === "video" ? { media_type: "VIDEO" } : {}),
    })
    if (!data.id) throw new Error("instagram: conteneur enfant sans id")
    return data.id
  }

  return {
    async createContainer(_job: PublishJob, ctx: PublishContext) {
      validateInstagramMedia(ctx.media, ctx.format)
      const first = ctx.media[0] as JobMedia

      if (ctx.format === "carousel") {
        // Les enfants d'abord, le parent ensuite. Si l'on tombe entre les deux,
        // la tentative suivante recrée des enfants : on laisse des conteneurs
        // orphelins (Meta les expire en 24 h) mais AUCUNE publication — c'est le
        // bon côté du compromis, l'ancre n'est pas encore posée.
        const children: string[] = []
        for (const m of ctx.media) children.push(await createChild(ctx, m))
        const { data } = await call<CreateResponse>(ctx, "POST", `${ctx.providerAccountId}/media`, {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption: ctx.caption || undefined,
        })
        if (!data.id) throw new Error("instagram: conteneur carrousel sans id")
        return { containerId: data.id }
      }

      const params: Record<string, string | undefined> = {
        ...mediaParams(first),
        caption: ctx.caption || undefined,
      }
      if (ctx.format === "reel") params.media_type = "REELS"
      else if (ctx.format === "story") params.media_type = "STORIES"
      // `alt_text` n'est accepté que sur une image simple : le poser sur un
      // conteneur REELS fait échouer la création avec un code 100.
      if (ctx.format !== "reel" && first.kind === "image" && first.altText) {
        params.alt_text = first.altText
      }

      const { data } = await call<CreateResponse>(
        ctx,
        "POST",
        `${ctx.providerAccountId}/media`,
        params
      )
      if (!data.id) throw new Error("instagram: conteneur sans id")
      return { containerId: data.id }
    },

    async publish(job: PublishJob, containerId: string, ctx: PublishContext) {
      const { data } = await call<CreateResponse>(
        ctx,
        "POST",
        `${ctx.providerAccountId}/media_publish`,
        { creation_id: containerId }
      )
      if (!data.id) throw new Error("instagram: media_publish sans id de media")
      return await resolveById(job, data.id, ctx)
    },

    async getContainerStatus(_job: PublishJob, containerId: string, ctx: PublishContext) {
      const { data } = await call<StatusResponse>(ctx, "GET", containerId, {
        fields: "status_code,status",
      })
      return mapStatusCode(data.status_code)
    },

    /**
     * RÈGLE 15, sortie du chemin de reprise : le conteneur est PUBLISHED, il
     * faut retrouver le média publié. Meta expose le champ dérivé
     * `?fields=id,permalink` sur le CONTENEUR — c'est ce qui permet de conclure
     * sans republier.
     */
    async resolvePublished(job: PublishJob, containerId: string, ctx: PublishContext) {
      const { data } = await call<PublishedResponse>(ctx, "GET", containerId, {
        fields: "id,permalink",
      })
      // `id` du conteneur vaut l'id du média publié chez Meta ; on retombe
      // dessus si le champ manque plutôt que d'écrire un identifiant vide.
      return await resolveById(job, data.id ?? containerId, ctx, data.permalink)
    },
  }

  /** Complète le résultat avec le permalien (utile au portail client). */
  async function resolveById(
    _job: PublishJob,
    mediaId: string,
    ctx: PublishContext,
    known?: string
  ): Promise<PublishResult> {
    if (known) return { externalPostId: mediaId, permalink: known, targetStatus: "published" }
    try {
      const { data } = await call<PublishedResponse>(ctx, "GET", mediaId, { fields: "permalink" })
      return { externalPostId: mediaId, permalink: data.permalink, targetStatus: "published" }
    } catch {
      // Le post EST en ligne : échouer ici pour un permalien manquant
      // renverrait le job en retry et produirait un doublon. Le permalien est
      // du confort, l'id est la vérité.
      return { externalPostId: mediaId, targetStatus: "published" }
    }
  }
}
