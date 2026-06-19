import type {
  ContentFormat,
  ContentStatus,
  Platform,
  QuotaUsage,
  SocialAccount,
} from "@/lib/mocks/types"

// Types et constantes du board studio : filtres, tris, vues, kanban.

export type SortKey = "priority" | "scheduled" | "created" | "status"
export type BoardViewMode = "list" | "kanban"

export interface BoardFilters {
  search: string
  statuses: ContentStatus[]
  platforms: Platform[]
  formats: ContentFormat[]
  pillarIds: string[]
  labels: string[]
}

export const EMPTY_FILTERS: BoardFilters = {
  search: "",
  statuses: [],
  platforms: [],
  formats: [],
  pillarIds: [],
  labels: [],
}

export const SORT_LABELS: Record<SortKey, string> = {
  priority: "À traiter d'abord",
  scheduled: "Date planifiée",
  created: "Date de création",
  status: "Statut",
}

/** Ordre du cycle de vie — utilisé par le tri « Statut ». */
export const STATUS_ORDER: ContentStatus[] = [
  "idea",
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
  "canceled",
]

/** Étiquettes proposées par défaut dans l'éditeur d'étiquettes. */
export const CANONICAL_LABELS = ["Lancement", "Promo", "Marronnier", "Evergreen"]

const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const CANONICAL_COLOR: Record<string, string> = {
  Lancement: CHART_VARS[0],
  Promo: CHART_VARS[1],
  Marronnier: CHART_VARS[2],
  Evergreen: CHART_VARS[3],
}

/** Couleur déterministe d'une étiquette (tokens chart-1..5 uniquement). */
export function labelColorVar(label: string): string {
  const fixed = CANONICAL_COLOR[label]
  if (fixed) return fixed
  let hash = 0
  for (const char of label) hash = (hash * 31 + char.codePointAt(0)!) % 997
  return CHART_VARS[hash % CHART_VARS.length]
}

/** Jauge de quota d'un compte social connecté (calculée côté page). */
export interface QuotaRow {
  account: SocialAccount
  usage: QuotaUsage
}

// ---------------------------------------------------------------------------
// Kanban de production

export type KanbanColumnId = "idea" | "draft" | "in_review" | "approved" | "scheduled" | "published"

export const KANBAN_COLUMNS: { id: KanbanColumnId; label: string }[] = [
  { id: "idea", label: "Idée" },
  { id: "draft", label: "Brouillon" },
  { id: "in_review", label: "En validation" },
  { id: "approved", label: "Validé" },
  { id: "scheduled", label: "Programmé" },
  { id: "published", label: "Publié" },
]

/** Colonne kanban d'un statut — null = hors kanban (annulé). */
export function kanbanColumnOf(status: ContentStatus): KanbanColumnId | null {
  switch (status) {
    case "idea":
      return "idea"
    case "draft":
    case "changes_requested":
      return "draft"
    case "in_review":
      return "in_review"
    case "approved":
      return "approved"
    case "scheduled":
    case "publishing":
    case "failed":
      return "scheduled"
    case "published":
    case "partially_published":
      return "published"
    case "canceled":
      return null
  }
}

/** Statuts verrouillés : la publication a commencé, plus de drag possible. */
export const KANBAN_LOCKED: ContentStatus[] = ["publishing", "published", "partially_published"]
