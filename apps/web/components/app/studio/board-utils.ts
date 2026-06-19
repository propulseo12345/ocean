import { days, MOCK_NOW } from "@/lib/mocks/time"
import type { ContentItem, ContentStatus, Reviewer, ReviewRequest } from "@/lib/mocks/types"
import { type BoardFilters, type SortKey, STATUS_ORDER } from "./board-types"

// Helpers purs du board studio : recherche, tri, priorités, suivi de revue.

const LATE_DRAFT_AFTER_DAYS = 7
const REMIND_AFTER_DAYS = 2

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/** Recherche plein texte : titre, légende, étiquettes et hashtags. */
export function matchesSearch(item: ContentItem, query: string): boolean {
  if (query.trim().length === 0) return true
  const haystack = normalize(
    [item.title, item.caption, ...(item.labels ?? []), ...item.hashtags].join(" ")
  )
  return normalize(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

export function matchesFilters(item: ContentItem, f: BoardFilters): boolean {
  if (!matchesSearch(item, f.search)) return false
  if (f.statuses.length > 0 && !f.statuses.includes(item.status)) return false
  if (f.formats.length > 0 && !f.formats.includes(item.format)) return false
  if (f.platforms.length > 0 && !item.targets.some((t) => f.platforms.includes(t.platform))) {
    return false
  }
  if (f.pillarIds.length > 0 && !f.pillarIds.includes(item.pillarId ?? "")) return false
  if (f.labels.length > 0 && !(item.labels ?? []).some((l) => f.labels.includes(l))) return false
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
    new Date(item.createdAt).getTime() < MOCK_NOW.getTime() - days(LATE_DRAFT_AFTER_DAYS)
  )
}

/** Programmé dans le passé sans avoir été publié — à reprogrammer. */
export function isOverdue(item: ContentItem): boolean {
  return (
    item.scheduledAt !== null &&
    new Date(item.scheduledAt).getTime() < MOCK_NOW.getTime() &&
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
  /** Badge « En attente depuis N j » (in_review uniquement). */
  waitLabel: string | null
  /** Relance proposée : attente > 2 j ou reviewer jamais venu depuis l'envoi. */
  canRemind: boolean
}

export function cardReviewMeta(
  item: ContentItem,
  request: ReviewRequest | null,
  reviewer: Reviewer | null
): CardReviewMeta {
  if (item.status !== "in_review") return { waitLabel: null, canRemind: false }
  const sentAt = request?.contentIds.includes(item.id) ? request.sentAt : item.createdAt
  const waitDays = Math.max(
    0,
    Math.floor((MOCK_NOW.getTime() - new Date(sentAt).getTime()) / days(1))
  )
  const reviewerSilent =
    reviewer !== null && (reviewer.lastActiveAt === null || reviewer.lastActiveAt < sentAt)
  return {
    waitLabel: waitDays >= 1 ? `En attente depuis ${waitDays} j` : "Envoyé aujourd'hui",
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

/** Étiquettes disponibles : celles déjà posées chez ce client + canoniques. */
export function collectLabels(items: ContentItem[], canonical: string[]): string[] {
  const set = new Set<string>(canonical)
  for (const item of items) for (const label of item.labels ?? []) set.add(label)
  return [...set].sort((a, b) => a.localeCompare(b, "fr"))
}
