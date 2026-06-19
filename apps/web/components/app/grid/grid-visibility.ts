import type { ContentFormat, ContentStatus } from "@/lib/mocks/types"
import type { CoverCompareTarget } from "./cover-compare-dialog"
import { FINAL_RENDER_STATUSES, type GridTileData } from "./grid-types"

// Helpers purs de visibilité de la grille : covers testées, filtres
// statut/format, mode « rendu final », cible du comparateur de covers.

/** Message d'impact d'un compte IG à reconnecter (publications menacées). */
export function planExpiryImpact(plannedCount: number): string | undefined {
  if (plannedCount <= 0) return undefined
  const noun =
    plannedCount > 1 ? "publications planifiées échoueront" : "publication planifiée échouera"
  return `${plannedCount} ${noun} tant que le compte n'est pas reconnecté.`
}

export const STATUS_ORDER: ContentStatus[] = [
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

export const FORMAT_ORDER: ContentFormat[] = ["post", "carousel", "reel"]

/** Applique la cover testée localement (comparateur) à la tuile. */
export function makeWithCover(overrides: Record<string, string>) {
  return (t: GridTileData): GridTileData =>
    overrides[t.id] ? { ...t, coverUrl: overrides[t.id] } : t
}

/** Filtre statut/format — les tuiles fantômes (emplacements) passent toujours. */
export function makeMatchesFilters(
  statusFilter: ReadonlySet<ContentStatus>,
  formatFilter: ReadonlySet<ContentFormat>
) {
  return (t: GridTileData): boolean => {
    if (t.ghost) return true
    if (statusFilter.size > 0 && !statusFilter.has(t.status ?? "published")) return false
    if (formatFilter.size > 0 && !formatFilter.has(t.format)) return false
    return true
  }
}

/** Tuile conservée en « rendu final » : le feed tel qu'il sera réellement publié. */
export function isFinalTile(t: GridTileData): boolean {
  return !t.ghost && t.status !== undefined && FINAL_RENDER_STATUSES.includes(t.status)
}

/** Construit la cible du comparateur de covers (avec voisines de grille). */
export function buildCoverTarget(
  tile: GridTileData,
  effective: GridTileData,
  allVisible: GridTileData[]
): CoverCompareTarget | null {
  if (!tile.media) return null
  const current = effective.coverUrl ?? tile.media.thumbUrl
  const alternative =
    current === tile.media.thumbUrl ? (tile.coverUrl ?? tile.media.thumbUrl) : tile.media.thumbUrl
  const idx = allVisible.findIndex((t) => t.id === tile.id)
  const thumbOf = (t: GridTileData | undefined) => t?.coverUrl ?? t?.media?.thumbUrl ?? null
  return {
    tile: effective,
    current,
    alternative,
    prevThumb: thumbOf(allVisible[idx - 1]),
    nextThumb: thumbOf(allVisible[idx + 1]),
  }
}
