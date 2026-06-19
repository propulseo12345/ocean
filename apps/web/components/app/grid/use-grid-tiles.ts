"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/format"
import { retryDate, shiftDays } from "./grid-date-utils"
import { buildPlaceholder, insertFromShelf, insertSlot, permuteDates } from "./grid-mutations"
import {
  GRID_DROP_ID,
  type GridTileData,
  isSortableTile,
  type PillarOption,
  SHELF_PREFIX,
} from "./grid-types"

// État de la zone planifiée : permutations en attente (Appliquer / Annuler),
// dépôt depuis l'étagère, créneaux, emplacements par pilier, actions par lot.
// Les permutations par drag restent « en attente » ; toute autre mutation
// est confirmée immédiatement par toast et remet le compteur à zéro.

interface Snapshot {
  planned: GridTileData[]
  shelf: GridTileData[]
}

const byDateDesc = (a: GridTileData, b: GridTileData) =>
  (b.dateIso ?? "").localeCompare(a.dateIso ?? "")

const plural = (n: number) => (n > 1 ? "s" : "")

export function useGridTiles(
  initialPlanned: GridTileData[],
  initialShelf: GridTileData[],
  tz: string,
  studioHref: string
) {
  const [planned, setPlanned] = useState(initialPlanned)
  const [shelf, setShelf] = useState(initialShelf)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const initialRef = useRef<Snapshot>({ planned: initialPlanned, shelf: initialShelf })
  const baselineRef = useRef<Snapshot>(initialRef.current)
  const counterRef = useRef(0)

  const plannedRef = useRef(planned)
  plannedRef.current = planned
  const shelfRef = useRef(shelf)
  shelfRef.current = shelf

  function commit(nextPlanned: GridTileData[], nextShelf: GridTileData[] = shelfRef.current) {
    setPlanned(nextPlanned)
    setShelf(nextShelf)
    baselineRef.current = { planned: nextPlanned, shelf: nextShelf }
    setHistory([])
  }

  function permute(fromId: string, toId: string) {
    const result = permuteDates(plannedRef.current, fromId, toId)
    if (!result) return
    setHistory((h) => [...h, { planned: plannedRef.current, shelf: shelfRef.current }])
    setPlanned(result.next)
    toast.info("Permutation de dates en attente (aperçu)", {
      description: result.newDateIso
        ? `« ${result.movedTitle} » passerait au ${formatDateTime(result.newDateIso, tz)}. Applique ou annule dans la barre sous la grille.`
        : "Applique ou annule dans la barre sous la grille.",
    })
  }

  function dropFromShelf(shelfId: string, over: DragEndEvent["over"]) {
    const tile = shelfRef.current.find((t) => t.id === shelfId)
    if (!tile) return
    if (!over) {
      toast.warning("Dépose la carte sur la zone planifiée de la grille")
      return
    }
    if (over.data.current?.locked) {
      toast.warning("Zone verrouillée — dépôt impossible", {
        description: "Les publications publiées ou importées sont en lecture seule.",
      })
      return
    }
    const prev = plannedRef.current
    const idx = over.id === GRID_DROP_ID ? prev.length : prev.findIndex((t) => t.id === over.id)
    const { next, dateIso } = insertFromShelf(prev, tile, idx < 0 ? prev.length : idx, tz)
    commit(
      next,
      shelfRef.current.filter((t) => t.id !== shelfId)
    )
    toast.success(`Brouillon planifié au ${formatDateTime(dateIso, tz)} (aperçu)`, {
      description: "Aucune date réelle n'est attribuée pendant la preview.",
    })
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const id = String(event.active.id)
    const over = event.over
    if (id.startsWith(SHELF_PREFIX)) {
      dropFromShelf(id.slice(SHELF_PREFIX.length), over)
      return
    }
    if (!over) return
    if (over.data.current?.locked) {
      toast.warning("Zone verrouillée — dépôt impossible", {
        description:
          "Publiés et importés ne bougent pas ; seules les tuiles planifiées se permutent.",
      })
      return
    }
    if (String(over.id) === id || over.id === GRID_DROP_ID) return
    permute(id, String(over.id))
  }

  function applyPending() {
    baselineRef.current = { planned: plannedRef.current, shelf: shelfRef.current }
    setHistory([])
    toast.success("Permutations appliquées (aperçu)", {
      description: "Aucune date réelle n'est modifiée pendant la preview.",
    })
  }

  function undoLast() {
    setHistory((h) => {
      const last = h[h.length - 1]
      if (!last) return h
      setPlanned(last.planned)
      setShelf(last.shelf)
      return h.slice(0, -1)
    })
  }

  function revertAll() {
    setPlanned(baselineRef.current.planned)
    setShelf(baselineRef.current.shelf)
    setHistory([])
  }

  function insertSlotBefore(tile: GridTileData) {
    counterRef.current += 1
    const id = `slot_${counterRef.current}`
    const result = insertSlot(plannedRef.current, tile, id, tz, studioHref)
    if (!result || !tile.dateIso) return
    commit(result.next)
    toast.success(`Créneau libre inséré le ${formatDateTime(tile.dateIso, tz)} (aperçu)`, {
      description: `${result.shifted} publication${plural(result.shifted)} décalée${plural(result.shifted)} d'un jour.`,
    })
  }

  function addPlaceholder(pillar: PillarOption) {
    counterRef.current += 1
    const id = `ph_${counterRef.current}`
    const ghost = buildPlaceholder(plannedRef.current, pillar, id, tz, studioHref)
    commit([ghost, ...plannedRef.current])
    toast.success(`Emplacement « ${pillar.label} » réservé (aperçu)`, {
      description:
        "Glisse la tuile à la position voulue, puis convertis-la en contenu via le studio.",
    })
  }

  function retryTile(tile: GridTileData) {
    const date = retryDate(tz)
    const next = plannedRef.current
      .map((t) =>
        t.id === tile.id
          ? { ...t, status: "scheduled" as const, dateIso: date, lastError: undefined }
          : t
      )
      .sort(byDateDesc)
    commit(next)
    toast.success(`« ${tile.title} » reprogrammé au ${formatDateTime(date, tz)} (aperçu)`)
  }

  function mapSelected(ids: string[], fn: (t: GridTileData) => GridTileData) {
    const set = new Set(ids)
    return plannedRef.current.map((t) =>
      set.has(t.id) && isSortableTile(t) && !t.ghost ? fn(t) : t
    )
  }

  function batchShiftWeek(ids: string[]) {
    commit(
      mapSelected(ids, (t) => (t.dateIso ? { ...t, dateIso: shiftDays(t.dateIso, 7) } : t)).sort(
        byDateDesc
      )
    )
    toast.success(
      `${ids.length} publication${plural(ids.length)} décalée${plural(ids.length)} d'une semaine (aperçu)`
    )
  }

  function batchSendReview(ids: string[]) {
    commit(mapSelected(ids, (t) => ({ ...t, status: "in_review" as const })))
    toast.success(`Validation demandée pour ${ids.length} contenu${plural(ids.length)} (aperçu)`, {
      description: "Le client les retrouverait dans son portail de validation.",
    })
  }

  function batchCancel(ids: string[]) {
    commit(mapSelected(ids, (t) => ({ ...t, status: "canceled" as const })))
    toast.success(`Planification annulée pour ${ids.length} contenu${plural(ids.length)} (aperçu)`)
  }

  function resetTiles() {
    commit(initialRef.current.planned, initialRef.current.shelf)
  }

  const activeTile = activeId
    ? activeId.startsWith(SHELF_PREFIX)
      ? (shelf.find((t) => `${SHELF_PREFIX}${t.id}` === activeId) ?? null)
      : (planned.find((t) => t.id === activeId) ?? null)
    : null

  return {
    planned,
    shelf,
    activeTile,
    activeFromShelf: activeId?.startsWith(SHELF_PREFIX) ?? false,
    pendingCount: history.length,
    onDragStart,
    onDragEnd,
    onDragCancel: () => setActiveId(null),
    applyPending,
    undoLast,
    revertAll,
    insertSlotBefore,
    addPlaceholder,
    retryTile,
    batchShiftWeek,
    batchSendReview,
    batchCancel,
    resetTiles,
  }
}

export type GridTilesState = ReturnType<typeof useGridTiles>
