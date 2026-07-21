import "server-only"

import { cache } from "react"

import type {
  ContentFormat,
  ContentItem,
  ContentStatus,
  ContentTarget,
  Platform,
  TargetStatus,
} from "@/lib/domain"
import { createClient } from "@/lib/supabase/server"
import { loadContentMedia } from "./content-media"

// Câblage Supabase de la lecture CŒUR : les ContentItem complets (cibles,
// médias, étiquettes). Un ContentItem coûte 4 requêtes pour N contenus, jamais
// N requêtes — toutes les hydratations sont batchées par `in(...)`.

const ITEM_COLUMNS =
  "id, client_id, title, caption, hashtags, format, status, scheduled_at, newsletter_subject, " +
  "internal_notes, created_at, created_by, approval_stale, last_error, first_comment, pillar_id, " +
  "pinned, exclude_from_grid, deleted_at, client_comments_count, cover_media_asset_id"

/**
 * Statuts d'un contenu visibles par un Reviewer. Copie EXACTE de
 * `private.is_reviewer_visible_content` (migration 013, décision D7) : la RLS
 * reste la source de vérité, ce filtre est la défense en profondeur (règle 7).
 */
const REVIEWER_VISIBLE_STATUSES: ContentStatus[] = [
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
]

interface ItemRow {
  id: string
  client_id: string
  title: string | null
  caption: string | null
  hashtags: string[]
  format: string
  status: string
  scheduled_at: string | null
  newsletter_subject: string | null
  internal_notes: string | null
  created_at: string
  created_by: string | null
  approval_stale: boolean
  last_error: unknown
  first_comment: string | null
  pillar_id: string | null
  pinned: boolean
  exclude_from_grid: boolean
  deleted_at: string | null
  client_comments_count: number
  cover_media_asset_id: string | null
}

/**
 * `content_items.last_error` est un jsonb `{ code, message }` écrit par le
 * worker (cas SYSTÈME du plan §6 T3). On n'affiche que le message, et jamais
 * le blob brut : un cast naïf mettrait `[object Object]` dans l'UI.
 */
function errorMessage(value: unknown): string | null {
  if (typeof value === "string") return value || null
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return null
}

/** Cibles par contenu, en une requête. Scope explicite = client_id (cf. média). */
async function loadTargets(
  clientIds: string[],
  itemIds: string[]
): Promise<Map<string, ContentTarget[]>> {
  const byItem = new Map<string, ContentTarget[]>()
  if (itemIds.length === 0 || clientIds.length === 0) return byItem

  const supabase = await createClient()
  const { data } = await supabase
    .from("content_targets")
    .select(
      "id, content_item_id, social_account_id, platform, status, external_post_id, permalink, published_at, caption_override"
    )
    .in("client_id", clientIds)
    .in("content_item_id", itemIds)
    .order("created_at", { ascending: true })

  for (const row of data ?? []) {
    const list = byItem.get(row.content_item_id) ?? []
    list.push({
      id: row.id,
      platform: row.platform as Platform,
      socialAccountId: row.social_account_id,
      status: row.status as TargetStatus,
      externalPostId: row.external_post_id ?? undefined,
      permalink: row.permalink ?? undefined,
      publishedAt: row.published_at ?? undefined,
      captionOverride: row.caption_override ? row.caption_override : undefined,
    })
    byItem.set(row.content_item_id, list)
  }
  return byItem
}

/** Étiquettes par contenu, en deux requêtes (liaisons puis noms). */
async function loadLabels(clientIds: string[], itemIds: string[]): Promise<Map<string, string[]>> {
  const byItem = new Map<string, string[]>()
  if (itemIds.length === 0 || clientIds.length === 0) return byItem

  const supabase = await createClient()
  const { data: links } = await supabase
    .from("content_item_labels")
    .select("content_item_id, content_label_id")
    .in("client_id", clientIds)
    .in("content_item_id", itemIds)

  const linkRows = links ?? []
  if (linkRows.length === 0) return byItem

  const labelIds = [...new Set(linkRows.map((l) => l.content_label_id))]
  const { data: labels } = await supabase
    .from("content_labels")
    .select("id, name")
    .in("client_id", clientIds)
    .in("id", labelIds)
    .order("sort_order", { ascending: true })

  const nameById = new Map((labels ?? []).map((l) => [l.id, l.name]))
  for (const link of linkRows) {
    const name = nameById.get(link.content_label_id)
    if (!name) continue
    const list = byItem.get(link.content_item_id) ?? []
    list.push(name)
    byItem.set(link.content_item_id, list)
  }
  return byItem
}

/** Assemble des lignes content_items en ContentItem complets. */
async function hydrate(rows: ItemRow[]): Promise<ContentItem[]> {
  if (rows.length === 0) return []
  const itemIds = rows.map((row) => row.id)
  // Le scope des hydratations est déduit des lignes déjà filtrées, jamais d'un
  // paramètre : impossible de charger les médias d'un contenu qu'on n'a pas lu.
  const clientIds = [...new Set(rows.map((row) => row.client_id))]

  const coverIdByItem = new Map<string, string>()
  for (const row of rows) {
    if (row.cover_media_asset_id) coverIdByItem.set(row.id, row.cover_media_asset_id)
  }

  const [targets, media, labels] = await Promise.all([
    loadTargets(clientIds, itemIds),
    loadContentMedia(clientIds, itemIds, coverIdByItem),
    loadLabels(clientIds, itemIds),
  ])

  return rows.map((row) => {
    const error = errorMessage(row.last_error)
    const itemLabels = labels.get(row.id)
    return {
      id: row.id,
      clientId: row.client_id,
      title: row.title ?? "",
      caption: row.caption ?? "",
      hashtags: row.hashtags,
      format: row.format as ContentFormat,
      status: row.status as ContentStatus,
      scheduledAt: row.scheduled_at,
      newsletterSubject: row.newsletter_subject ? row.newsletter_subject : undefined,
      internalNotes: row.internal_notes ? row.internal_notes : undefined,
      media: media.byItem.get(row.id) ?? [],
      targets: targets.get(row.id) ?? [],
      createdAt: row.created_at,
      createdBy: row.created_by ?? "",
      // Compteur CLIENT-only : un count naïf révélerait le volume interne au
      // reviewer (migration 013).
      commentsCount: row.client_comments_count,
      approvalStale: row.approval_stale,
      lastError: error ? error : undefined,
      firstComment: row.first_comment ? row.first_comment : undefined,
      pillarId: row.pillar_id ?? undefined,
      pinned: row.pinned,
      excludeFromGrid: row.exclude_from_grid,
      coverUrl: media.coverByItem.get(row.id),
      deletedAt: row.deleted_at ?? undefined,
      labels: itemLabels?.length ? itemLabels : undefined,
    }
  })
}

export const getContentItems = cache(
  async (orgId: string, clientId?: string): Promise<ContentItem[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    let query = supabase
      .from("content_items")
      .select(ITEM_COLUMNS)
      .eq("org_id", orgId)
      .is("deleted_at", null)
    if (clientId) query = query.eq("client_id", clientId)
    const { data } = await query.order("created_at", { ascending: true })

    return hydrate((data ?? []) as unknown as ItemRow[])
  }
)

export const getContentItem = cache(
  async (orgId: string, clientId: string, id: string): Promise<ContentItem | null> => {
    if (!orgId) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_items")
      .select(ITEM_COLUMNS)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("id", id)
      .maybeSingle()

    if (!data) return null
    const [item] = await hydrate([data as unknown as ItemRow])
    return item ?? null
  }
)

export const getTrashedContent = cache(
  async (orgId: string, clientId?: string): Promise<ContentItem[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    let query = supabase
      .from("content_items")
      .select(ITEM_COLUMNS)
      .eq("org_id", orgId)
      .not("deleted_at", "is", null)
    if (clientId) query = query.eq("client_id", clientId)
    const { data } = await query.order("deleted_at", { ascending: false })

    return hydrate((data ?? []) as unknown as ItemRow[])
  }
)

// --- Portail Reviewer -------------------------------------------------------
// Le Reviewer n'a PAS d'org active : son scope est l'ensemble de ses lignes
// client_members (résolues par getReviewerContext). On filtre donc sur
// client_id et JAMAIS sur org_id : un reviewer peut être invité par deux
// freelances différents, et `getReviewerContext().orgId` ne garde que la
// première appartenance — filtrer dessus lui masquerait silencieusement le
// second client. Un client appartient à une seule org (UNIQUE(id, org_id)),
// donc le filtre client reste au moins aussi fort. La RLS fait foi.

export const getPortalContent = cache(async (clientIds: string[]): Promise<ContentItem[]> => {
  if (clientIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("content_items")
    .select(ITEM_COLUMNS)
    .in("client_id", clientIds)
    .in("status", REVIEWER_VISIBLE_STATUSES)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true, nullsFirst: false })

  return hydrate((data ?? []) as unknown as ItemRow[])
})

export const getPortalContentItem = cache(
  async (clientIds: string[], contentId: string): Promise<ContentItem | null> => {
    if (clientIds.length === 0) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_items")
      .select(ITEM_COLUMNS)
      .in("client_id", clientIds)
      .in("status", REVIEWER_VISIBLE_STATUSES)
      .is("deleted_at", null)
      .eq("id", contentId)
      .maybeSingle()

    if (!data) return null
    const [item] = await hydrate([data as unknown as ItemRow])
    return item ?? null
  }
)

export { REVIEWER_VISIBLE_STATUSES }
