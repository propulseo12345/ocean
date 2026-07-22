"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { scheduleContentItem } from "@/lib/actions/content"
import { applyStatusIntent } from "@/lib/actions/content-status"
import { formatDateTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
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
//
// PERSISTANCE (Server Actions) : le dépôt étagère (scheduleContentItem), l'envoi
// des permutations (scheduleContentItem par date modifiée), le décalage groupé
// (scheduleContentItem) et les lots validation/annulation (applyStatusIntent)
// écrivent réellement, optimiste + rollback + refresh. Les créneaux/emplacements
// fantômes et la reprogrammation d'un échec restent des aides LOCALES (pas de
// content_item réel / couplé au worker).

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
  clientId: string,
  studioHref: string
) {
  const t = useT()
  const router = useRouter()
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
    toast.info(t("grid.tiles.permutePending"), {
      description: result.newDateIso
        ? t("grid.tiles.permutePendingDate", {
            title: result.movedTitle,
            date: formatDateTime(result.newDateIso, tz),
          })
        : t("grid.tiles.permutePendingPlain"),
    })
  }

  // Dépôt étagère : date le brouillon (scheduleContentItem, statut inchangé) et
  // le fait passer sur la grille. Optimiste + rollback si l'écriture échoue.
  async function dropFromShelf(shelfId: string, over: DragEndEvent["over"]) {
    const tile = shelfRef.current.find((t) => t.id === shelfId)
    if (!tile) return
    if (!over) {
      toast.warning(t("grid.tiles.dropOnPlanned"))
      return
    }
    if (over.data.current?.locked) {
      toast.warning(t("grid.tiles.locked"), { description: t("grid.tiles.lockedShelf") })
      return
    }
    const prevPlanned = plannedRef.current
    const prevShelf = shelfRef.current
    const idx =
      over.id === GRID_DROP_ID ? prevPlanned.length : prevPlanned.findIndex((t) => t.id === over.id)
    const { next, dateIso } = insertFromShelf(prevPlanned, tile, idx < 0 ? prevPlanned.length : idx, tz)
    commit(
      next,
      prevShelf.filter((t) => t.id !== shelfId)
    )
    const res = await scheduleContentItem({ clientId, contentId: shelfId, scheduledAt: dateIso })
    if (!res.ok) {
      setPlanned(prevPlanned)
      setShelf(prevShelf)
      baselineRef.current = { planned: prevPlanned, shelf: prevShelf }
      setHistory([])
      toast.error(t("grid.tiles.shelfError"))
      return
    }
    toast.success(t("grid.tiles.shelfScheduled", { date: formatDateTime(dateIso, tz) }), {
      description: t("grid.tiles.shelfScheduledDesc"),
    })
    router.refresh()
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
      toast.warning(t("grid.tiles.locked"), { description: t("grid.tiles.lockedPermute") })
      return
    }
    if (String(over.id) === id || over.id === GRID_DROP_ID) return
    permute(id, String(over.id))
  }

  // Envoi des permutations en attente : persiste la nouvelle date de chaque tuile
  // réelle dont la date a changé vs la baseline (scheduleContentItem). En cas
  // d'échec, on restaure la baseline précédente pour que « Revenir » soit fiable.
  async function applyPending() {
    const prevBaseline = baselineRef.current
    const base = new Map(prevBaseline.planned.map((tile) => [tile.id, tile.dateIso]))
    const changed = plannedRef.current.filter(
      (tile) => isSortableTile(tile) && !tile.ghost && tile.dateIso && base.get(tile.id) !== tile.dateIso
    )
    baselineRef.current = { planned: plannedRef.current, shelf: shelfRef.current }
    setHistory([])
    if (changed.length === 0) return

    const results = await Promise.all(
      changed.map((tile) =>
        scheduleContentItem({ clientId, contentId: tile.id, scheduledAt: tile.dateIso })
      )
    )
    if (results.some((r) => !r.ok)) {
      baselineRef.current = prevBaseline
      toast.error(t("grid.tiles.permuteError"))
      router.refresh()
      return
    }
    toast.success(t("grid.tiles.permuteApplied"), {
      description: t("grid.tiles.permuteAppliedDesc", { count: changed.length }),
    })
    router.refresh()
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

  /** Cibles réelles d'un lot : tuiles sélectionnées, triables, non fantômes. */
  function batchTargets(ids: string[]): GridTileData[] {
    const set = new Set(ids)
    return plannedRef.current.filter((t) => set.has(t.id) && isSortableTile(t) && !t.ghost)
  }

  // Décalage groupé d'une semaine : persiste la nouvelle date de chaque cible
  // (scheduleContentItem). Optimiste + rollback global si une écriture échoue.
  async function batchShiftWeek(ids: string[]) {
    const prev = plannedRef.current
    const next = mapSelected(ids, (t) => (t.dateIso ? { ...t, dateIso: shiftDays(t.dateIso, 7) } : t))
    const targets = next.filter(
      (t) => ids.includes(t.id) && isSortableTile(t) && !t.ghost && t.dateIso
    )
    if (targets.length === 0) return
    commit(next.sort(byDateDesc))
    const results = await Promise.all(
      targets.map((t) => scheduleContentItem({ clientId, contentId: t.id, scheduledAt: t.dateIso }))
    )
    if (results.some((r) => !r.ok)) {
      commit(prev)
      toast.error(t("grid.tiles.shiftWeekError"))
      return
    }
    toast.success(t("grid.tiles.batchShiftWeek", { count: targets.length }))
    router.refresh()
  }

  // Envoi en validation groupé : transition send_to_review par cible. La
  // transition suffit à faire apparaître les contenus dans le portail (statut
  // in_review, RLS reviewer). Optimiste + rollback global.
  async function batchSendReview(ids: string[]) {
    const prev = plannedRef.current
    const targets = batchTargets(ids)
    if (targets.length === 0) return
    commit(mapSelected(ids, (t) => ({ ...t, status: "in_review" as const })))
    const results = await Promise.all(
      targets.map((t) =>
        applyStatusIntent({ clientId, contentId: t.id, intent: "send_to_review" })
      )
    )
    if (results.some((r) => !r.ok)) {
      commit(prev)
      toast.error(t("grid.tiles.reviewError"))
      return
    }
    toast.success(t("grid.tiles.batchReview", { count: targets.length }), {
      description: t("grid.tiles.batchReviewDesc"),
    })
    router.refresh()
  }

  // Annulation groupée : transition cancel par cible. Optimiste + rollback global.
  async function batchCancel(ids: string[]) {
    const prev = plannedRef.current
    const targets = batchTargets(ids)
    if (targets.length === 0) return
    commit(mapSelected(ids, (t) => ({ ...t, status: "canceled" as const })))
    const results = await Promise.all(
      targets.map((t) => applyStatusIntent({ clientId, contentId: t.id, intent: "cancel" }))
    )
    if (results.some((r) => !r.ok)) {
      commit(prev)
      toast.error(t("grid.tiles.cancelError"))
      return
    }
    toast.success(t("grid.tiles.batchCancel", { count: targets.length }))
    router.refresh()
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
