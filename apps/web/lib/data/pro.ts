import "server-only"

import { cache } from "react"

import { loc } from "@/lib/i18n"
import type {
  ActivityEntry,
  ActivityKind,
  ApprovalDecision,
  Approval as ApprovalType,
  BrandKit,
  ClientEvent,
  Comment as CommentType,
  ContentPillar,
  ContentVersion,
  HashtagGroup,
  LibraryAsset,
  LibraryAssetSource,
  MediaType,
  MemberRole,
  Platform,
  RecurringSlot,
  Reviewer,
  ReviewRequest,
  ReviewRequestState,
  SavedView,
  SavedViewFilters,
} from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

const ORIGINALS_BUCKET = "media-originals"
const THUMBS_BUCKET = "media-thumbs"
const SIGNED_URL_TTL = 3600 // 1 h

// Câblage Supabase de la configuration éditoriale (Phase 1). Les lectures
// filtrent explicitement org_id + client_id (défense en profondeur, règle 7) en
// plus de la RLS. Le mapping enveloppe `text -> loc(x, x)` : les types front
// portent encore `L<string>` jusqu'à l'aplatissement de la Phase 7 ; l'UI reste
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
      name: loc(row.name, row.name),
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
      tone: loc(data.tone ?? "", data.tone ?? ""),
      doList: data.do_list.map((item) => loc(item, item)),
      dontList: data.dont_list.map((item) => loc(item, item)),
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
      name: loc(row.name, row.name),
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
      title: loc(row.title, row.title),
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
        name: loc(row.name, row.name),
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
        altText: row.alt_text ? loc(row.alt_text, row.alt_text) : undefined,
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
        body: loc(row.body, row.body),
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
      message: row.message ? loc(row.message, row.message) : undefined,
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
      caption: loc(row.caption ?? "", row.caption ?? ""),
      note: loc(row.note ?? "", row.note ?? ""),
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
      detail: loc(row.detail ?? "", row.detail ?? ""),
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
      message: data.message ? loc(data.message, data.message) : undefined,
      sentAt: data.sent_at,
      state,
    }
  }
)

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
