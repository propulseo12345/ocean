"use client"

import { useCallback, useMemo, useState } from "react"
import { nowIso } from "@/lib/clock"
import type { ClientEvent } from "@/lib/domain"
import {
  type CalendarData,
  type CalendarFilters,
  type CalendarView,
  EMPTY_FILTERS,
  hasActiveFilters,
  matchesFilters,
} from "./calendar-types"
import {
  type CalendarCursor,
  cursorFromKey,
  type DayKey,
  dayKeyOf,
  groupByDay,
  monthGridKeys,
  monthOf,
  shiftMonth,
  shiftWeek,
  weekGridKeys,
} from "./calendar-utils"

// État central du calendrier : période unifiée mois/semaine, filtres,
// replanifications mockées (overrides) et notes locales.

function firstDayKey(cursor: CalendarCursor): DayKey {
  return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`
}

export function useCalendarState(data: CalendarData) {
  const tz = data.client.timezone
  const todayKey = useMemo(() => dayKeyOf(nowIso(), tz), [tz])

  // Période UNIFIÉE : l'ancre survit à la bascule mois ⇄ semaine.
  const [view, setView] = useState<CalendarView>("month")
  const [anchorKey, setAnchorKey] = useState<DayKey>(todayKey)
  const cursor = useMemo(() => cursorFromKey(anchorKey), [anchorKey])

  const goToday = useCallback(() => setAnchorKey(todayKey), [todayKey])
  const goPrev = useCallback(() => {
    setAnchorKey((a) =>
      view === "month" ? firstDayKey(shiftMonth(cursorFromKey(a), -1)) : shiftWeek(a, -7)
    )
  }, [view])
  const goNext = useCallback(() => {
    setAnchorKey((a) =>
      view === "month" ? firstDayKey(shiftMonth(cursorFromKey(a), 1)) : shiftWeek(a, 7)
    )
  }, [view])
  const goMonth = useCallback((year: number, month: number) => {
    setAnchorKey(firstDayKey({ year, month }))
  }, [])

  // Filtres persistants (survivent à la navigation de période).
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS)
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  // Bascules d'affichage.
  const [showMarronniers, setShowMarronniers] = useState(true)
  const [legendOpen, setLegendOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)

  // Replanifications mockées : id → nouvel ISO (null = remis sans date).
  const [overrides, setOverrides] = useState<ReadonlyMap<string, string | null>>(new Map())
  const setOverride = useCallback((id: string, iso: string | null) => {
    setOverrides((prev) => new Map(prev).set(id, iso))
  }, [])
  const setOverridesBatch = useCallback((entries: [string, string | null][]) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      for (const [id, iso] of entries) next.set(id, iso)
      return next
    })
  }, [])

  // Notes locales ajoutées depuis le calendrier (aperçu).
  const [localEvents, setLocalEvents] = useState<ClientEvent[]>([])
  const addNote = useCallback(
    (dayKey: DayKey, title: string, kind: ClientEvent["kind"]) => {
      setLocalEvents((prev) => [
        ...prev,
        {
          id: `local_${prev.length}_${dayKey}`,
          clientId: data.client.id,
          date: `${dayKey}T12:00:00.000Z`,
          // Note saisie par l'utilisateur : un seul texte, stocké pour les 2 locales.
          title: title,
          kind,
        },
      ])
    },
    [data.client.id]
  )

  // Données effectives = mocks + replanifications locales.
  const effectiveItems = useMemo(
    () =>
      data.items.map((it) =>
        overrides.has(it.id) ? { ...it, scheduledAt: overrides.get(it.id) ?? null } : it
      ),
    [data.items, overrides]
  )
  const datedItems = useMemo(
    () => effectiveItems.filter((it) => it.scheduledAt !== null),
    [effectiveItems]
  )
  const shelfItems = useMemo(
    () => effectiveItems.filter((it) => it.scheduledAt === null),
    [effectiveItems]
  )
  const filteredDated = useMemo(
    () => datedItems.filter((it) => matchesFilters(it, filters)),
    [datedItems, filters]
  )

  const itemsByDay = useMemo(() => groupByDay(filteredDated, tz), [filteredDated, tz])
  const allByDay = useMemo(() => groupByDay(datedItems, tz), [datedItems, tz])

  const monthDays = useMemo(() => monthGridKeys(cursor), [cursor])
  const weekDays = useMemo(() => weekGridKeys(anchorKey), [anchorKey])
  const inMonthDays = useMemo(
    () => monthDays.filter((k) => monthOf(k) === cursor.month),
    [monthDays, cursor.month]
  )
  const periodDays = view === "month" ? inMonthDays : weekDays

  // Compteur de résultats sur la période affichée (filtres actifs).
  const counts = useMemo(() => {
    let visible = 0
    let total = 0
    for (const key of periodDays) {
      visible += itemsByDay.get(key)?.length ?? 0
      total += allByDay.get(key)?.length ?? 0
    }
    return { visible, masked: total - visible, total }
  }, [periodDays, itemsByDay, allByDay])

  const eventsByDay = useMemo(() => {
    const out = new Map<DayKey, ClientEvent[]>()
    for (const ev of [...data.events, ...localEvents]) {
      const key = dayKeyOf(ev.date, tz)
      const bucket = out.get(key)
      if (bucket) bucket.push(ev)
      else out.set(key, [ev])
    }
    return out
  }, [data.events, localEvents, tz])

  const monthItems = useMemo(() => {
    const inMonth = new Set(inMonthDays)
    return datedItems.filter((it) => inMonth.has(dayKeyOf(it.scheduledAt as string, tz)))
  }, [datedItems, inMonthDays, tz])

  const pendingReview = useMemo(
    () => effectiveItems.filter((it) => it.status === "in_review"),
    [effectiveItems]
  )

  return {
    tz,
    todayKey,
    view,
    setView,
    cursor,
    anchorKey,
    goToday,
    goPrev,
    goNext,
    goMonth,
    filters,
    setFilters,
    clearFilters,
    filtersActive: hasActiveFilters(filters),
    showMarronniers,
    setShowMarronniers,
    legendOpen,
    setLegendOpen,
    selectionMode,
    setSelectionMode,
    setOverride,
    setOverridesBatch,
    addNote,
    effectiveItems,
    datedItems,
    shelfItems,
    itemsByDay,
    allByDay,
    monthDays,
    weekDays,
    inMonthDays,
    counts,
    eventsByDay,
    monthItems,
    pendingReview,
  }
}

export type CalendarState = ReturnType<typeof useCalendarState>
