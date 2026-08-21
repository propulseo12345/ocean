import { NeedsReauthError, PermanentPublishError, type PublishJob } from "../domain"
import type { Queryable } from "./queryable"

// Ce que le worker doit savoir de la CIBLE avant de parler à la plateforme :
// l'identifiant du compte CHEZ le fournisseur, la connexion dont dépend son
// token, et la légende.
//
// Le job ne transporte que des uuid Ocean. `social_accounts.provider_account_id`
// est l'identifiant Meta/TikTok — l'id de l'utilisateur Instagram, l'id de la
// Page, l'open_id TikTok — c'est-à-dire ce qui va dans l'URL de l'appel. Sans
// lui, aucun publisher ne peut composer sa requête.

export interface PublishTarget {
  /** Identifiant du compte CHEZ la plateforme (ig-user-id, page-id, open_id). */
  providerAccountId: string
  /** Connexion OAuth parente : c'est elle qui porte le refresh (règle 14). */
  connectionId: string
  /** Valeur de `platform_connections.provider` (facebook | tiktok | …). */
  connectionProvider: string
  /** Légende finale, hashtags réinjectés (voir composeCaption). */
  caption: string
  /** `content_items.format` : distingue un reel d'un post, donc l'appel à faire. */
  format: "post" | "carousel" | "reel" | "story"
  /** Premier commentaire Instagram (hashtags hors légende). */
  firstComment: string | null
}

interface TargetRow extends Record<string, unknown> {
  provider_account_id: string
  platform_connection_id: string
  account_status: string
  connection_provider: string
  connection_status: string
  caption: string | null
  hashtags: string[] | null
  format: string
  first_comment: string | null
  caption_override: string | null
}

/**
 * Recompose la légende telle que l'utilisateur l'a tapée.
 *
 * `content_items.caption` ne contient PAS les hashtags : `saveContentItem` les
 * extrait dans `hashtags[]` (web, actions/content.ts:60) et le composer les
 * réinjecte à l'édition sous la forme `légende\n\n#a #b` (composer-types.ts:206).
 * Publier `caption` seul amputerait chaque post de ses hashtags — sans erreur,
 * sans trace, et personne ne s'en apercevrait avant de regarder Instagram.
 *
 * ⚠ Convention DUPLIQUÉE avec le web, comme REFRESH_MARGIN_DAYS : les deux
 * paquets ne partagent aucun module. Le commentaire est présent des deux côtés
 * pour qu'une divergence future soit visible.
 *
 * Un `caption_override` de cible est pris TEL QUEL : il vient d'un champ où
 * l'utilisateur écrit ses hashtags en ligne, il est déjà complet.
 */
export function composeCaption(input: {
  captionOverride: string | null
  caption: string | null
  hashtags: string[] | null
}): string {
  if (input.captionOverride?.trim()) return input.captionOverride
  const base = input.caption ?? ""
  const tags = (input.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ")
    .trim()
  if (!tags) return base
  return base ? `${base}\n\n${tags}` : tags
}

export async function loadPublishTarget(pool: Queryable, job: PublishJob): Promise<PublishTarget> {
  const { rows } = await pool.query<TargetRow>(
    `select sa.provider_account_id,
            sa.platform_connection_id,
            sa.status::text        as account_status,
            pc.provider::text      as connection_provider,
            pc.status::text        as connection_status,
            ci.caption,
            ci.hashtags,
            ci.format::text        as format,
            ci.first_comment,
            ct.caption_override
     from public.social_accounts sa
     join public.platform_connections pc on pc.id = sa.platform_connection_id
     join public.content_items ci   on ci.id = $2
     join public.content_targets ct on ct.id = $3
     where sa.id = $1`,
    [job.socialAccountId, job.contentItemId, job.contentTargetId]
  )
  const row = rows[0]
  if (!row) {
    throw new PermanentPublishError(
      `compte social ${job.socialAccountId} introuvable (compte supprime ?)`
    )
  }

  // Un compte DÉTACHÉ (036) n'attend rien de personne : le marquer needs_reauth
  // rallumerait le bandeau « reconnecte-moi » sur un geste délibéré. Échec
  // permanent, sans demande de reconnexion.
  if (row.account_status === "disconnected" || row.connection_status === "disconnected") {
    throw new PermanentPublishError(`compte ${job.socialAccountId} detache (disconnected)`)
  }
  // needs_reauth : publier avec un token qu'on sait mort produirait une erreur
  // Meta plus confuse que la vérité, deux minutes plus tard.
  if (row.account_status === "needs_reauth" || row.connection_status === "needs_reauth") {
    throw new NeedsReauthError(`compte ${job.socialAccountId} en needs_reauth avant publication`)
  }

  return {
    providerAccountId: row.provider_account_id,
    connectionId: row.platform_connection_id,
    connectionProvider: row.connection_provider,
    caption: composeCaption({
      captionOverride: row.caption_override,
      caption: row.caption,
      hashtags: row.hashtags,
    }),
    format: row.format as PublishTarget["format"],
    firstComment: row.first_comment,
  }
}
