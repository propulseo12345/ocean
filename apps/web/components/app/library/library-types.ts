import type { ContentStatus, LibraryAssetSource } from "@/lib/mocks/types"

// Types partagés de la médiathèque client (preview, données mockées).

/** Référence d'un contenu utilisant un asset — pour les liens vers le studio. */
export interface UsageRef {
  id: string
  title: string
  status: ContentStatus
  href: string
}

/** Map contentId → référence, construite côté serveur. */
export type ContentRefMap = Record<string, UsageRef>

export type TypeFilter = "all" | "image" | "video"
export type SourceFilter = "all" | LibraryAssetSource
export type UsageFilter = "all" | "used" | "unused"
/** « issues » = au moins une erreur de specs Instagram. */
export type SpecFilter = "all" | "issues"

export interface LibraryFilters {
  search: string
  type: TypeFilter
  source: SourceFilter
  usage: UsageFilter
  specs: SpecFilter
}

export const EMPTY_FILTERS: LibraryFilters = {
  search: "",
  type: "all",
  source: "all",
  usage: "all",
  specs: "all",
}

export type SortKey = "recent" | "weight" | "usage"

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Plus récents",
  weight: "Plus lourds",
  usage: "Plus utilisés",
}

/** Statistiques d'en-tête (chips cliquables = filtres). */
export interface LibraryStatsData {
  total: number
  unused: number
  deposit: number
  offSpec: number
}
