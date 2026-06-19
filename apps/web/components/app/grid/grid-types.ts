import type {
  ContentFormat,
  ContentStatus,
  EngagementStats,
  MediaAsset,
  Platform,
  TargetStatus,
} from "@/lib/mocks/types"

// Vue-modèle d'une tuile de grille (sérialisable, construit côté serveur).

export type GridGroup = "scheduled" | "published" | "imported"

/** Ratio d'affichage du feed — Instagram recadre le profil en 3:4 depuis 2025. */
export type GridRatio = "1:1" | "3:4"

export interface TilePlatform {
  platform: Platform
  status: TargetStatus
}

/** Tuile fantôme : emplacement réservé par pilier ou créneau libre inséré. */
export interface GhostInfo {
  label: string
  colorVar: string
}

export interface GridTileData {
  id: string
  group: GridGroup
  media: MediaAsset | null
  mediaCount: number
  format: ContentFormat
  title: string
  /** ISO UTC ; date planifiée ou de publication (null si non daté). */
  dateIso: string | null
  /** Fuseau du client pour l'affichage des dates. */
  tz: string
  href?: string
  permalink?: string
  status?: ContentStatus
  platforms?: TilePlatform[]
  pillarId?: string
  pinned?: boolean
  excludedFromGrid?: boolean
  coverUrl?: string
  caption?: string
  commentsCount?: number
  approvalStale?: boolean
  lastError?: string
  metrics?: EngagementStats
  isTopPost?: boolean
  ghost?: GhostInfo
}

export interface PillarOption {
  id: string
  label: string
  colorVar: string
}

/** Statuts déplaçables de la zone planifiée (permutation de dates). */
export const SORTABLE_STATUSES: ContentStatus[] = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
]

/** Statuts conservés en mode « rendu final » (le feed tel qu'il sera publié). */
export const FINAL_RENDER_STATUSES: ContentStatus[] = ["approved", "scheduled"]

export function isSortableTile(tile: GridTileData): boolean {
  if (tile.group !== "scheduled") return false
  if (tile.ghost) return true
  return tile.status !== undefined && SORTABLE_STATUSES.includes(tile.status)
}

export const RATIO_CLASS: Record<GridRatio, string> = {
  "1:1": "aspect-square",
  "3:4": "aspect-[3/4]",
}

/** Valeur numérique largeur/hauteur du ratio d'affichage. */
export const RATIO_VALUE: Record<GridRatio, number> = {
  "1:1": 1,
  "3:4": 3 / 4,
}

/** Part du média perdue au recadrage object-cover (par côté, 0..0.5). */
export function cropLoss(
  media: MediaAsset | null,
  ratio: GridRatio
): { axis: "x" | "y"; perSide: number } | null {
  if (!media || media.height === 0) return null
  const r = media.width / media.height
  const c = RATIO_VALUE[ratio]
  const MIN_VISIBLE_LOSS = 0.03
  if (r > c) {
    const perSide = (1 - c / r) / 2
    return perSide > MIN_VISIBLE_LOSS ? { axis: "x", perSide } : null
  }
  const perSide = (1 - r / c) / 2
  return perSide > MIN_VISIBLE_LOSS ? { axis: "y", perSide } : null
}

/** Préfixe des ids draggables de l'étagère (distingués des tuiles triables). */
export const SHELF_PREFIX = "shelf__"

/** Id de la zone droppable « grille » (insertion quand la zone planifiée est vide). */
export const GRID_DROP_ID = "grid-planned-zone"
