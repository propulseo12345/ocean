import type { MessageKey } from "@/lib/i18n"
import type { L } from "@/lib/i18n/localized"
import type { ContentStatus, LibraryAssetSource } from "@/lib/mocks/types"

// Types partagés de la médiathèque client (preview, données mockées).

/** Référence d'un contenu utilisant un asset — pour les liens vers le studio. */
export interface UsageRef {
  id: string
  /** Titre du contenu (bilingue) — résolu via pick() à l'affichage. */
  title: L<string>
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

/** Clés i18n des libellés de tri — résolues via t() à l'affichage. */
export const SORT_LABEL_KEYS: Record<SortKey, MessageKey> = {
  recent: "library.sort.recent",
  weight: "library.sort.weight",
  usage: "library.sort.usage",
}

/** Statistiques d'en-tête (chips cliquables = filtres). */
export interface LibraryStatsData {
  total: number
  unused: number
  deposit: number
  offSpec: number
}
