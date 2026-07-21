import type {
  Client,
  ClientEvent,
  ContentFormat,
  ContentItem,
  ContentPillar,
  ContentStatus,
  Platform,
  QuotaUsage,
  SocialAccount,
} from "@/lib/domain"

// Types partagés du calendrier éditorial (état, filtres, contexte des cases).

export type CalendarView = "month" | "week"

export interface CalendarData {
  client: Client
  /** Clients actifs de l'org (cible de duplication cross-client). */
  clients: Client[]
  items: ContentItem[]
  accounts: SocialAccount[]
  pillars: ContentPillar[]
  events: ClientEvent[]
  reviewerName: string | null
  /** Date d'envoi de la dernière demande de validation (mock). */
  reviewSentAt: string | null
  igQuota: QuotaUsage | null
}

export interface CalendarFilters {
  statuses: ContentStatus[]
  platforms: Platform[]
  formats: ContentFormat[]
  pillarIds: string[]
}

export const EMPTY_FILTERS: CalendarFilters = {
  statuses: [],
  platforms: [],
  formats: [],
  pillarIds: [],
}

export function hasActiveFilters(f: CalendarFilters): boolean {
  return (
    f.statuses.length > 0 ||
    f.platforms.length > 0 ||
    f.formats.length > 0 ||
    f.pillarIds.length > 0
  )
}

export function matchesFilters(item: ContentItem, f: CalendarFilters): boolean {
  if (f.statuses.length > 0 && !f.statuses.includes(item.status)) return false
  if (f.formats.length > 0 && !f.formats.includes(item.format)) return false
  if (f.platforms.length > 0 && !item.targets.some((t) => f.platforms.includes(t.platform))) {
    return false
  }
  if (f.pillarIds.length > 0 && (!item.pillarId || !f.pillarIds.includes(item.pillarId))) {
    return false
  }
  return true
}

/** Actions contextuelles d'une carte, fournies par l'orchestrateur. */
export interface EntryCallbacks {
  onReschedule: (item: ContentItem) => void
  onDuplicate: (item: ContentItem) => void
  onRetry: (item: ContentItem) => void
  onRemind: (item: ContentItem) => void
}

/** Contexte transversal passé aux cases et aux cartes (1 prop au lieu de 12). */
export interface DayContext {
  clientId: string
  tz: string
  todayKey: string
  selectionMode: boolean
  showMarronniers: boolean
  /** Jours appartenant à un trou de cadence (liseré pointillé). */
  gapDays: ReadonlySet<string>
  /** Nombre de publications Instagram par jour (pastille de densité). */
  densityByDay: ReadonlyMap<string, number>
  eventsByDay: ReadonlyMap<string, ClientEvent[]>
  /** Ids des contenus dont un compte cible doit être reconnecté. */
  accountIssueIds: ReadonlySet<string>
  /** Jours d'attente de validation par contenu (in_review/changes_requested). */
  waitingDays: ReadonlyMap<string, number>
  pillarById: ReadonlyMap<string, ContentPillar>
  isSelected: (id: string) => boolean
  onToggleSelect: (id: string) => void
  onOpenDay: (dayKey: string) => void
  callbacks: EntryCallbacks
}

// Seuils nommés (zéro nombre magique dans les composants).
export const MAX_VISIBLE_PER_CELL = 3
export const GAP_THRESHOLD_DAYS = 4
export const DENSITY_INFO_AT = 3
export const DENSITY_WARN_AT = 5
export const SWIPE_THRESHOLD_PX = 56
