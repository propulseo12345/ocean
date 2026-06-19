import { arrayMove } from "@dnd-kit/sortable"
import { interpolateDate, shiftDays } from "./grid-date-utils"
import { type GridTileData, isSortableTile, type PillarOption } from "./grid-types"

// Mutations pures de la zone planifiée (testables, sans état ni toast).

/**
 * Permutation des DATES (sémantique PRD) : les créneaux restent fixes, seuls
 * les contenus déplaçables changent de créneau — les tuiles en échec, annulées
 * ou en cours gardent leur date et leur position.
 */
export function permuteDates(
  prev: GridTileData[],
  fromId: string,
  toId: string
): { next: GridTileData[]; movedTitle: string; newDateIso: string | null } | null {
  const sortables = prev.map((t, i) => ({ t, i })).filter(({ t }) => isSortableTile(t))
  const fromPos = sortables.findIndex((s) => s.t.id === fromId)
  const toPos = sortables.findIndex((s) => s.t.id === toId)
  if (fromPos < 0 || toPos < 0 || fromPos === toPos) return null

  const subset = sortables.map((s) => s.t)
  const dates = subset.map((t) => t.dateIso)
  const moved = arrayMove(subset, fromPos, toPos).map((t, k) => ({ ...t, dateIso: dates[k] }))
  const next = [...prev]
  sortables.forEach((s, k) => {
    next[s.i] = moved[k]
  })
  return { next, movedTitle: subset[fromPos].title, newDateIso: dates[toPos] }
}

/** Insertion d'une carte d'étagère à la position visée, avec date interpolée. */
export function insertFromShelf(
  prev: GridTileData[],
  tile: GridTileData,
  at: number,
  tz: string
): { next: GridTileData[]; dateIso: string } {
  const dateIso = interpolateDate(prev[at - 1]?.dateIso ?? null, prev[at]?.dateIso ?? null, tz)
  const next = [...prev]
  next.splice(at, 0, { ...tile, group: "scheduled", status: "draft", dateIso })
  return { next, dateIso }
}

/**
 * Insère un créneau libre à la date de la tuile visée et décale d'un jour
 * toutes les publications déplaçables à partir de cette date.
 */
export function insertSlot(
  prev: GridTileData[],
  tile: GridTileData,
  ghostId: string,
  tz: string,
  studioHref: string
): { next: GridTileData[]; shifted: number } | null {
  const idx = prev.findIndex((t) => t.id === tile.id)
  const date = tile.dateIso
  if (idx < 0 || !date) return null

  let shifted = 0
  const next = prev.map((t) => {
    if (isSortableTile(t) && t.dateIso && t.dateIso >= date) {
      shifted += 1
      return { ...t, dateIso: shiftDays(t.dateIso, 1) }
    }
    return t
  })
  next.splice(idx + 1, 0, {
    id: ghostId,
    group: "scheduled",
    media: null,
    mediaCount: 0,
    format: "post",
    title: "Nouveau créneau",
    dateIso: date,
    tz,
    href: studioHref,
    ghost: { label: "Nouveau créneau", colorVar: "var(--primary)" },
  })
  return { next, shifted }
}

/** Tuile fantôme « emplacement réservé » teintée du pilier, insérée en tête. */
export function buildPlaceholder(
  prev: GridTileData[],
  pillar: PillarOption,
  ghostId: string,
  tz: string,
  studioHref: string
): GridTileData {
  const firstDate = prev.find((t) => isSortableTile(t) && t.dateIso)?.dateIso ?? null
  return {
    id: ghostId,
    group: "scheduled",
    media: null,
    mediaCount: 0,
    format: "post",
    title: `Emplacement ${pillar.label}`,
    dateIso: interpolateDate(null, firstDate, tz),
    tz,
    href: studioHref,
    pillarId: pillar.id,
    ghost: { label: pillar.label, colorVar: pillar.colorVar },
  }
}
