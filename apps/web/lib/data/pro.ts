import "server-only"

import { cache } from "react"

import { loc } from "@/lib/i18n"
import type {
  BrandKit,
  ClientEvent,
  ContentPillar,
  HashtagGroup,
  Platform,
  RecurringSlot,
  SavedView,
  SavedViewFilters,
} from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

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
