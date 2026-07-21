import { now } from "@/lib/clock"
import { type Locale, pick } from "@/lib/i18n"
import { days } from "@/lib/mocks/time"
import type { ContentItem, ContentStatus, Reviewer, ReviewRequest } from "@/lib/mocks/types"
import { type BoardFilters, type SortKey, STATUS_ORDER } from "./board-types"

// Helpers purs du board studio : recherche, tri, priorités, suivi de revue.
// Les étiquettes (string) sont résolues dans la locale active avant toute
// comparaison/affichage — le board manipule des libellés `string` résolus.

const LATE_DRAFT_AFTER_DAYS = 7
const REMIND_AFTER_DAYS = 2

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/** Recherche plein texte : titre, légende, étiquettes et hashtags. */
export function matchesSearch(item: ContentItem, query: string, locale: Locale): boolean {
  if (query.trim().length === 0) return true
  const haystack = normalize(
    [
      pick(item.title, locale),
      pick(item.caption, locale),
      ...(item.labels ?? []).map((l) => pick(l, locale)),
      ...item.hashtags,
    ].join(" ")
  )
  return normalize(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

export function matchesFilters(item: ContentItem, f: BoardFilters, locale: Locale): boolean {
  if (!matchesSearch(item, f.search, locale)) return false
  if (f.statuses.length > 0 && !f.statuses.includes(item.status)) return false
  if (f.formats.length > 0 && !f.formats.includes(item.format)) return false
  if (f.platforms.length > 0 && !item.targets.some((t) => f.platforms.includes(t.platform))) {
    return false
  }
  if (f.pillarIds.length > 0 && !f.pillarIds.includes(item.pillarId ?? "")) return false
  if (f.labels.length > 0 && !(item.labels ?? []).some((l) => f.labels.includes(pick(l, locale)))) {
    return false
  }
  return true
}

export function filtersAreEmpty(f: BoardFilters): boolean {
  return countActiveFilters(f) === 0 && f.search.trim().length === 0
}

/** Nombre de filtres actifs (hors recherche) — badge du bouton Filtres. */
export function countActiveFilters(f: BoardFilters): number {
  return (
    f.statuses.length + f.platforms.length + f.formats.length + f.pillarIds.length + f.labels.length
  )
}

// ---------------------------------------------------------------------------
// Tris

/** Brouillon en retard : sans date et créé il y a plus de 7 jours. */
export function isLateDraft(item: ContentItem): boolean {
  return (
    item.status === "draft" &&
    item.scheduledAt === null &&
    new Date(item.createdAt).getTime() < now().getTime() - days(LATE_DRAFT_AFTER_DAYS)
  )
}

/** Programmé dans le passé sans avoir été publié — à reprogrammer. */
export function isOverdue(item: ContentItem): boolean {
  return (
    item.scheduledAt !== null &&
    new Date(item.scheduledAt).getTime() < now().getTime() &&
    (item.status === "scheduled" || item.status === "approved" || item.status === "draft")
  )
}

/** Rang « À traiter d'abord » : échecs, retours, brouillons en retard… */
function priorityRank(item: ContentItem): number {
  switch (item.status) {
    case "failed":
      return 0
    case "changes_requested":
      return 1
    case "draft":
      return isLateDraft(item) ? 2 : 4
    case "partially_published":
      return 3
    case "idea":
      return 5
    case "approved":
      return 6
    case "in_review":
      return 7
    case "scheduled":
      return isOverdue(item) ? 2 : 8
    case "publishing":
      return 9
    case "published":
      return 10
    case "canceled":
      return 11
  }
}

function byScheduled(a: ContentItem, b: ContentItem): number {
  if (a.scheduledAt === null && b.scheduledAt === null) {
    return b.createdAt.localeCompare(a.createdAt)
  }
  if (a.scheduledAt === null) return 1
  if (b.scheduledAt === null) return -1
  return a.scheduledAt.localeCompare(b.scheduledAt)
}

export function sortItems(items: ContentItem[], sort: SortKey): ContentItem[] {
  const out = [...items]
  switch (sort) {
    case "priority":
      out.sort((a, b) => priorityRank(a) - priorityRank(b) || byScheduled(a, b))
      break
    case "scheduled":
      out.sort(byScheduled)
      break
    case "created":
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    case "status":
      out.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byScheduled(a, b)
      )
      break
  }
  return out
}

// ---------------------------------------------------------------------------
// Suivi de validation (ReviewRequest + Reviewer)

export interface CardReviewMeta {
  /** Nombre de jours d'attente (in_review) ; null = pas en attente. */
  waitDays: number | null
  /** Relance proposée : attente > 2 j ou reviewer jamais venu depuis l'envoi. */
  canRemind: boolean
}

export function cardReviewMeta(
  item: ContentItem,
  request: ReviewRequest | null,
  reviewer: Reviewer | null
): CardReviewMeta {
  if (item.status !== "in_review") return { waitDays: null, canRemind: false }
  const sentAt = request?.contentIds.includes(item.id) ? request.sentAt : item.createdAt
  const waitDays = Math.max(0, Math.floor((now().getTime() - new Date(sentAt).getTime()) / days(1)))
  const reviewerSilent =
    reviewer !== null && (reviewer.lastActiveAt === null || reviewer.lastActiveAt < sentAt)
  return {
    waitDays,
    canRemind: waitDays > REMIND_AFTER_DAYS || reviewerSilent,
  }
}

// ---------------------------------------------------------------------------
// Éligibilité aux actions en lot (machine à états PRD §5.B)

const REVIEWABLE: ContentStatus[] = ["draft", "changes_requested"]
const SCHEDULABLE: ContentStatus[] = ["idea", "draft", "approved"]
const LOCKED: ContentStatus[] = ["publishing", "published", "partially_published"]

export const canSendReview = (item: ContentItem) => REVIEWABLE.includes(item.status)
export const canSchedule = (item: ContentItem) => SCHEDULABLE.includes(item.status)
export const canCancel = (item: ContentItem) =>
  !LOCKED.includes(item.status) && item.status !== "canceled"

/** Étiquettes disponibles (résolues dans la locale) : posées chez ce client + canoniques. */
export function collectLabels(items: ContentItem[], canonical: string[], locale: Locale): string[] {
  const set = new Set<string>(canonical)
  for (const item of items) for (const label of item.labels ?? []) set.add(pick(label, locale))
  return [...set].sort((a, b) => a.localeCompare(b, locale))
}
