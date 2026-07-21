import "server-only"

import { cache } from "react"

import { PLATFORM_QUOTAS } from "@/lib/mocks/quotas"
import type {
  AccountStatus,
  ActivityEntry,
  ActivityKind,
  ApprovalDecision,
  Approval as ApprovalType,
  BrandKit,
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  ClientEvent,
  Comment as CommentType,
  ContentPillar,
  ContentVersion,
  EngagementStats,
  HashtagGroup,
  ImportedPost,
  LibraryAsset,
  LibraryAssetSource,
  MediaType,
  MemberRole,
  Platform,
  PostMetrics,
  QuotaUsage,
  RecurringSlot,
  Reviewer,
  ReviewRequest,
  ReviewRequestState,
  SavedView,
  SavedViewFilters,
} from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

// Quota « principal » affiché par plateforme (une jauge). IG = publications,
// FB = Reels, TikTok = brouillons. Les autres compteurs (ig_container, fb_buc)
// vivent en base mais ne sont pas la jauge de l'UI.
const PRIMARY_QUOTA_KIND: Partial<Record<Platform, string>> = {
  instagram: "ig_publish",
  facebook: "fb_reels",
  tiktok: "tt_draft",
}

const ORIGINALS_BUCKET = "media-originals"
const THUMBS_BUCKET = "media-thumbs"
const SIGNED_URL_TTL = 3600 // 1 h

// Câblage Supabase de la configuration éditoriale (Phase 1). Les lectures
// filtrent explicitement org_id + client_id (défense en profondeur, règle 7) en
// plus de la RLS. Le mapping enveloppe `text -> x` : les types front
// portent encore `string` jusqu'à l'aplatissement de la Phase 7 ; l'UI reste
// monolingue (D1), le toggle EN ne traduit pas le contenu client.

/** Réglages cadence/relance d'un client (client_settings, org-only — D4). */
export interface ClientSettings {
  reviewReminderDays: number
  cadenceGapDays: number
  cadenceMaxPerDay: number
  cadenceAlerts: { empty_week: boolean; gap: boolean; collision: boolean }
}

const CADENCE_ALERT_DEFAULTS = { empty_week: true, gap: true, collision: false }

export const getPillars = cache(
  async (orgId: string, clientId: string): Promise<ContentPillar[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_pillars")
      .select("id, client_id, name, color_token, target_share")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      colorVar: `var(--${row.color_token})`,
      targetShare: row.target_share,
    }))
  }
)

export const getBrandKit = cache(
  async (orgId: string, clientId: string): Promise<BrandKit | undefined> => {
    if (!orgId) return undefined
    const supabase = await createClient()
    const { data } = await supabase
      .from("brand_kits")
      .select("client_id, palette, tone, do_list, dont_list, banned_words")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .maybeSingle()

    if (!data) return undefined
    return {
      clientId: data.client_id,
      palette: data.palette,
      tone: data.tone ?? "",
      doList: data.do_list,
      dontList: data.dont_list,
      bannedWords: data.banned_words,
    }
  }
)

export const getHashtagGroups = cache(
  async (orgId: string, clientId: string): Promise<HashtagGroup[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("hashtag_groups")
      .select("id, client_id, name, tags")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      tags: row.tags,
    }))
  }
)

export const getClientEvents = cache(
  async (orgId: string, clientId: string): Promise<ClientEvent[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("client_events")
      .select("id, client_id, event_date, title, kind")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("event_date", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      // event_date est un DATE (jour, fuseau client). Rendu à T12:00:00Z : sûr
      // pour tous les fuseaux clients, aucun glissement de jour (audit §2).
      date: `${row.event_date}T12:00:00.000Z`,
      title: row.title,
      kind: row.kind as ClientEvent["kind"],
    }))
  }
)

export const getRecurringSlots = cache(
  async (orgId: string, clientId: string): Promise<RecurringSlot[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("recurring_slots")
      .select("id, client_id, weekday, time_of_day, platforms, pillar_id")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("weekday", { ascending: true })
      .order("time_of_day", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      weekday: row.weekday,
      // time est un TIME 'HH:MM:SS' ; le front attend 'HH:mm'.
      time: row.time_of_day.slice(0, 5),
      platforms: row.platforms as Platform[],
      pillarId: row.pillar_id ?? undefined,
    }))
  }
)

export const getSavedViews = cache(
  async (orgId: string, clientId: string): Promise<SavedView[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("saved_views")
      .select(
        "id, client_id, name, search, statuses, platforms, formats, pillar_ids, label_ids, is_default"
      )
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })

    return (data ?? []).map((row) => {
      const filters: SavedViewFilters = {}
      if (row.search) filters.search = row.search
      if (row.statuses.length) filters.statuses = row.statuses as SavedViewFilters["statuses"]
      if (row.platforms.length) filters.platforms = row.platforms as SavedViewFilters["platforms"]
      if (row.formats.length) filters.formats = row.formats as SavedViewFilters["formats"]
      if (row.pillar_ids.length) filters.pillarIds = row.pillar_ids
      if (row.label_ids.length) filters.labels = row.label_ids
      return {
        id: row.id,
        clientId: row.client_id,
        name: row.name,
        filters,
        isDefault: row.is_default,
      }
    })
  }
)

export const getLibraryAssets = cache(
  async (orgId: string, clientId: string): Promise<LibraryAsset[]> => {
    if (!orgId) return []
    const supabase = await createClient()

    const { data } = await supabase
      .from("media_assets")
      .select(
        "id, client_id, type, storage_path, thumb_path, width, height, duration_ms, alt_text, source, mime_type, byte_size, created_at"
      )
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    const rows = data ?? []
    if (rows.length === 0) return []

    // usedInContentIds : dérivé de content_media (un asset sert N contenus).
    const { data: links } = await supabase
      .from("content_media")
      .select("media_asset_id, content_item_id")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    const usedBy = new Map<string, string[]>()
    for (const link of links ?? []) {
      const list = usedBy.get(link.media_asset_id) ?? []
      list.push(link.content_item_id)
      usedBy.set(link.media_asset_id, list)
    }

    // thumbUrl : URL publique (bucket public). fullUrl : URL signée 1h de
    // l'original (batch, un seul appel) — jamais d'URL stockée en base.
    const thumbUrl = (path: string | null) =>
      path ? supabase.storage.from(THUMBS_BUCKET).getPublicUrl(path).data.publicUrl : ""

    const originalPaths = rows.map((r) => r.storage_path).filter((p): p is string => p !== null)
    const signed = new Map<string, string>()
    if (originalPaths.length > 0) {
      const { data: urls } = await supabase.storage
        .from(ORIGINALS_BUCKET)
        .createSignedUrls(originalPaths, SIGNED_URL_TTL)
      for (const u of urls ?? []) {
        if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
      }
    }

    return rows.map((row) => {
      const thumb = thumbUrl(row.thumb_path)
      const full = row.storage_path ? (signed.get(row.storage_path) ?? thumb) : thumb
      return {
        id: row.id,
        clientId: row.client_id,
        type: row.type as MediaType,
        thumbUrl: thumb,
        fullUrl: full,
        width: row.width ?? 0,
        height: row.height ?? 0,
        durationSec: row.duration_ms != null ? Math.round(row.duration_ms / 1000) : undefined,
        uploadedAt: row.created_at,
        source: row.source as LibraryAssetSource,
        usedInContentIds: usedBy.get(row.id) ?? [],
        altText: row.alt_text ? row.alt_text : undefined,
        fileSizeMb:
          row.byte_size != null ? Math.round((row.byte_size / (1024 * 1024)) * 10) / 10 : undefined,
        mimeType: row.mime_type ?? undefined,
      }
    })
  }
)

// --- Collaboration (migration 013) -----------------------------------------

export const getReviewer = cache(
  async (orgId: string, clientId: string): Promise<Reviewer | null> => {
    if (!orgId) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from("client_members")
      .select("user_id, last_active_at, profiles(email, full_name, initials)")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("role", "reviewer")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    const profile = data.profiles as unknown as {
      email: string | null
      full_name: string | null
      initials: string | null
    } | null
    const email = profile?.email ?? ""
    return {
      id: data.user_id,
      clientId,
      name: profile?.full_name ?? email,
      email,
      initials: profile?.initials ?? email.slice(0, 2).toUpperCase(),
      lastActiveAt: data.last_active_at,
    }
  }
)

export const getComments = cache(
  async (orgId: string, clientId: string, contentId: string): Promise<CommentType[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_comments")
      .select(
        "id, content_item_id, author_name, author_role, body, created_at, annotation_content_media_id, annotation_x, annotation_y"
      )
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("content_item_id", contentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    const rows = data ?? []
    // Résoudre les ancres d'annotation (content_media -> media_asset + position).
    const anchorIds = rows
      .map((r) => r.annotation_content_media_id)
      .filter((id): id is string => id !== null)
    const anchors = new Map<string, { mediaAssetId: string; slideIndex: number }>()
    if (anchorIds.length > 0) {
      const { data: media } = await supabase
        .from("content_media")
        .select("id, media_asset_id, position")
        .in("id", anchorIds)
      for (const m of media ?? []) {
        anchors.set(m.id, { mediaAssetId: m.media_asset_id, slideIndex: m.position })
      }
    }

    return rows.map((row) => {
      const anchor = row.annotation_content_media_id
        ? anchors.get(row.annotation_content_media_id)
        : undefined
      return {
        id: row.id,
        contentId: row.content_item_id,
        authorName: row.author_name ?? "",
        role: row.author_role as MemberRole,
        body: row.body,
        createdAt: row.created_at,
        annotation:
          anchor && row.annotation_x !== null && row.annotation_y !== null
            ? {
                mediaAssetId: anchor.mediaAssetId,
                slideIndex: anchor.slideIndex,
                x: row.annotation_x,
                y: row.annotation_y,
              }
            : undefined,
      }
    })
  }
)

export const getApprovals = cache(
  async (orgId: string, clientId: string, contentId: string): Promise<ApprovalType[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("approvals")
      .select("id, content_item_id, decided_by, decision, message, version_label, created_at")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("content_item_id", contentId)
      .order("created_at", { ascending: false })

    return (data ?? []).map((row) => ({
      id: row.id,
      contentId: row.content_item_id,
      reviewerId: row.decided_by ?? "",
      decision: row.decision as ApprovalDecision,
      message: row.message ? row.message : undefined,
      versionLabel: row.version_label ?? "",
      createdAt: row.created_at,
    }))
  }
)

export const getContentVersions = cache(
  async (orgId: string, clientId: string, contentId: string): Promise<ContentVersion[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_versions")
      .select("id, content_item_id, version_number, caption, note, created_at")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("content_item_id", contentId)
      .order("version_number", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      contentId: row.content_item_id,
      label: `v${row.version_number}`,
      caption: row.caption ?? "",
      note: row.note ?? "",
      createdAt: row.created_at,
    }))
  }
)

export const getActivityEntries = cache(
  async (orgId: string, clientId: string, contentId: string): Promise<ActivityEntry[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("content_activity")
      .select("id, content_item_id, at, actor_name, kind, detail")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("content_item_id", contentId)
      .order("at", { ascending: false })

    return (data ?? []).map((row) => ({
      id: row.id,
      contentId: row.content_item_id,
      at: row.at,
      actorName: row.actor_name ?? "Ocean",
      kind: row.kind as ActivityKind,
      // La phrase est composée à l'affichage (kind + payload) ; detail = surcharge.
      detail: row.detail ?? "",
    }))
  }
)

export const getReviewRequest = cache(
  async (orgId: string, clientId: string): Promise<ReviewRequest | null> => {
    if (!orgId) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from("review_requests")
      .select("id, client_id, message, sent_at")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .is("closed_at", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null

    const [{ data: items }, { data: recipients }] = await Promise.all([
      supabase
        .from("review_request_items")
        .select("content_item_id")
        .eq("org_id", orgId)
        .eq("review_request_id", data.id),
      supabase
        .from("review_request_recipients")
        .select("recipient_user_id")
        .eq("org_id", orgId)
        .eq("review_request_id", data.id),
    ])

    const contentIds = (items ?? []).map((i) => i.content_item_id)

    // state dérivé des statuts des contenus du lot.
    let state: ReviewRequestState = "pending"
    if (contentIds.length > 0) {
      const { data: statuses } = await supabase
        .from("content_items")
        .select("status")
        .in("id", contentIds)
      const done = (statuses ?? []).filter((s) =>
        ["approved", "scheduled", "publishing", "published", "partially_published"].includes(
          s.status
        )
      ).length
      if (done === contentIds.length) state = "done"
      else if (done > 0) state = "partial"
    }

    return {
      id: data.id,
      clientId: data.client_id,
      contentIds,
      reviewerIds: (recipients ?? []).map((r) => r.recipient_user_id),
      message: data.message ? data.message : undefined,
      sentAt: data.sent_at,
      state,
    }
  }
)

// --- Feed importé & performance (migration 014) -----------------------------

function emptyStatsFrom(
  rows: { likes: number; comments_count: number; saves: number; reach: number | null }[]
): EngagementStats {
  return rows.reduce<EngagementStats>(
    (acc, r) => ({
      likes: acc.likes + r.likes,
      comments: acc.comments + r.comments_count,
      reach: acc.reach + (r.reach ?? 0),
      saves: acc.saves + r.saves,
    }),
    { likes: 0, comments: 0, reach: 0, saves: 0 }
  )
}

export const getImportedPosts = cache(
  async (orgId: string, clientId: string): Promise<ImportedPost[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("imported_posts")
      .select(
        "id, client_id, permalink, media_product_type, thumb_path, thumb_url, is_pinned, published_at"
      )
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .is("deleted_on_platform_at", null)
      .order("published_at", { ascending: false })

    const rows = data ?? []
    if (rows.length === 0) return []

    const { data: metrics } = await supabase
      .from("post_metrics")
      .select("imported_post_id, likes, comments_count, saves, reach")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .not("imported_post_id", "is", null)
    const byPost = new Map<string, EngagementStats>()
    for (const m of metrics ?? []) {
      if (m.imported_post_id) byPost.set(m.imported_post_id, emptyStatsFrom([m]))
    }

    const publicThumb = (path: string | null, fallback: string | null) =>
      path
        ? supabase.storage.from(THUMBS_BUCKET).getPublicUrl(path).data.publicUrl
        : (fallback ?? "")

    return rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      thumbUrl: publicThumb(row.thumb_path, row.thumb_url),
      permalink: row.permalink ?? "",
      publishedAt: row.published_at,
      mediaType: (row.media_product_type === "REELS" ? "video" : "image") as MediaType,
      metrics: byPost.get(row.id),
      pinned: row.is_pinned,
    }))
  }
)

export const getPostMetrics = cache(
  async (orgId: string, refId: string): Promise<PostMetrics | undefined> => {
    if (!orgId) return undefined
    const supabase = await createClient()

    // 1) post importé : référence directe.
    const { data: imported } = await supabase
      .from("post_metrics")
      .select("likes, comments_count, saves, reach")
      .eq("org_id", orgId)
      .eq("imported_post_id", refId)
      .maybeSingle()
    if (imported) return { refId, ...emptyStatsFrom([imported]) }

    // 2) contenu Ocean : agréger les métriques de ses cibles (par plateforme).
    const { data: targets } = await supabase
      .from("content_targets")
      .select("id")
      .eq("org_id", orgId)
      .eq("content_item_id", refId)
    const targetIds = (targets ?? []).map((t) => t.id)
    if (targetIds.length === 0) return undefined

    const { data: rows } = await supabase
      .from("post_metrics")
      .select("likes, comments_count, saves, reach")
      .eq("org_id", orgId)
      .in("content_target_id", targetIds)
    if (!rows || rows.length === 0) return undefined
    return { refId, ...emptyStatsFrom(rows) }
  }
)

export const getTopPosts = cache(
  async (orgId: string, clientId: string, limit = 3): Promise<PostMetrics[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from("post_metrics")
      .select("content_target_id, imported_post_id, likes, comments_count, saves, reach")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("engagement_total", { ascending: false })
      .limit(limit * 2)

    const rows = data ?? []
    // Résoudre content_target_id -> content_item_id (refId côté app).
    const targetIds = rows.map((r) => r.content_target_id).filter((id): id is string => id !== null)
    const targetToItem = new Map<string, string>()
    if (targetIds.length > 0) {
      const { data: targets } = await supabase
        .from("content_targets")
        .select("id, content_item_id")
        .in("id", targetIds)
      for (const t of targets ?? []) targetToItem.set(t.id, t.content_item_id)
    }

    const seen = new Set<string>()
    const out: PostMetrics[] = []
    for (const row of rows) {
      const refId =
        row.imported_post_id ??
        (row.content_target_id ? targetToItem.get(row.content_target_id) : undefined)
      if (!refId || seen.has(refId)) continue
      seen.add(refId)
      out.push({ refId, ...emptyStatsFrom([row]) })
      if (out.length >= limit) break
    }
    return out
  }
)

export const getQuotaUsage = cache(
  async (orgId: string, accountId: string): Promise<QuotaUsage | null> => {
    if (!orgId) return null
    const supabase = await createClient()
    const { data: account } = await supabase
      .from("social_accounts")
      .select("platform")
      .eq("org_id", orgId)
      .eq("id", accountId)
      .maybeSingle()
    if (!account) return null

    const platform = account.platform as Platform
    const quota = PLATFORM_QUOTAS[platform]
    const kind = PRIMARY_QUOTA_KIND[platform]
    if (!quota || !kind) return null // newsletter / custom : pas de quota

    const { data: usage } = await supabase
      .from("social_account_quota_usage")
      .select("used, quota_limit")
      .eq("org_id", orgId)
      .eq("social_account_id", accountId)
      .eq("quota_kind", kind)
      .maybeSingle()

    // La limite fait foi côté code (packages/shared) ; used = cache DB.
    return {
      used: usage?.used ?? 0,
      limit: usage?.quota_limit ?? quota.limit,
      windowKey: quota.windowKey,
    }
  }
)

// --- Agenda unifié (migration 015) — scopé par UTILISATEUR ------------------
// La RLS filtre déjà sur auth.uid() ; on ajoute .eq('user_id') en défense en
// profondeur (règle 7). Un 2e admin de l'org ne voit jamais ces lignes.

export const getCalendarAccounts = cache(async (orgId: string): Promise<CalendarAccount[]> => {
  if (!orgId) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("calendar_accounts")
    .select("id, provider, label, email, status")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  return (data ?? []).map((row) => {
    const label = row.label ?? row.email
    return {
      id: row.id,
      provider: row.provider as CalendarProvider,
      label: label,
      email: row.email,
      status: row.status as AccountStatus,
    }
  })
})

export const getCalendarEvents = cache(async (orgId: string): Promise<CalendarEvent[]> => {
  if (!orgId) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("calendar_events")
    .select("id, calendar_id, title, location, all_day, starts_at, ends_at, start_date, end_date")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true, nullsFirst: true })

  const rows = data ?? []
  if (rows.length === 0) return []

  // Le niveau « calendrier » porte le compte, la couleur et le toggle.
  const { data: calendars } = await supabase
    .from("calendar_calendars")
    .select("id, calendar_account_id, name, color_slot, is_enabled")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
  const byCalendar = new Map(
    (calendars ?? []).map((c) => [
      c.id,
      {
        accountId: c.calendar_account_id,
        name: c.name,
        colorVar: `var(--chart-${c.color_slot ?? 1})`,
        enabled: c.is_enabled,
      },
    ])
  )

  return rows.flatMap((row) => {
    const cal = byCalendar.get(row.calendar_id)
    if (!cal) return []
    // all-day : DATE pure (jamais convertie en UTC) exposée à midi Z, comme les
    // événements client — aucun glissement de jour à la lecture.
    const startsAt = row.all_day ? `${row.start_date}T12:00:00.000Z` : (row.starts_at ?? "")
    const endsAt = row.all_day
      ? `${row.end_date ?? row.start_date}T12:00:00.000Z`
      : (row.ends_at ?? "")
    const title = row.title ?? ""
    return [
      {
        id: row.id,
        accountId: cal.accountId,
        calendarName: cal.name,
        colorVar: cal.colorVar,
        title: title,
        startsAt,
        endsAt,
        allDay: row.all_day,
        location: row.location ? row.location : undefined,
        enabled: cal.enabled,
      },
    ]
  })
})

export const getClientSettings = cache(
  async (orgId: string, clientId: string): Promise<ClientSettings> => {
    if (!orgId) {
      return {
        reviewReminderDays: 2,
        cadenceGapDays: 7,
        cadenceMaxPerDay: 2,
        cadenceAlerts: { ...CADENCE_ALERT_DEFAULTS },
      }
    }
    const supabase = await createClient()
    const { data } = await supabase
      .from("client_settings")
      .select("review_reminder_days, cadence_gap_days, cadence_max_per_day, cadence_alerts")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .maybeSingle()

    const alerts = (data?.cadence_alerts ?? {}) as Partial<ClientSettings["cadenceAlerts"]>
    return {
      reviewReminderDays: data?.review_reminder_days ?? 2,
      cadenceGapDays: data?.cadence_gap_days ?? 7,
      cadenceMaxPerDay: data?.cadence_max_per_day ?? 2,
      cadenceAlerts: {
        empty_week: alerts.empty_week ?? true,
        gap: alerts.gap ?? true,
        collision: alerts.collision ?? false,
      },
    }
  }
)
