"use client"

import { useCallback, useMemo, useState } from "react"
import { nowIso } from "@/lib/clock"
import { loc, useLocale } from "@/lib/i18n"
import { hours } from "@/lib/mocks/time"
import type {
  ContentItem,
  ContentStatus,
  Reviewer,
  ReviewRequest,
  SavedView,
} from "@/lib/mocks/types"
import { type BoardFilters, type BoardViewMode, EMPTY_FILTERS, type SortKey } from "./board-types"
import { matchesFilters, sortItems } from "./board-utils"

// État local du board studio (preview UI-only) : filtres, vues, tri, mode
// d'affichage et mutations mockées visibles (statuts, étiquettes, dates).

const HOUR_GAP_MS = hours(1)
const DAY_MS = hours(24)

// Identifiants locaux stables (jamais Date.now() : déterministe, SSR-safe).
let localSeq = 0
function nextLocalId(prefix: string): string {
  localSeq += 1
  return `${prefix}_${localSeq}`
}

export interface BoardStateInput {
  items: ContentItem[]
  savedViews: SavedView[]
  reviewer: Reviewer | null
  initialRequest: ReviewRequest | null
}

/** Filtres normalisés d'une vue (tous les champs présents, search string). */
function viewToFilters(view: SavedView | null): BoardFilters {
  if (!view) return EMPTY_FILTERS
  const f = view.filters
  return {
    search: f.search ?? "",
    statuses: f.statuses ?? [],
    platforms: f.platforms ?? [],
    formats: f.formats ?? [],
    pillarIds: f.pillarIds ?? [],
    labels: f.labels ?? [],
  }
}

export function useBoardState({ items, savedViews, reviewer, initialRequest }: BoardStateInput) {
  const { locale } = useLocale()
  // Vue par défaut : la colonne is_default (données réelles) ; repli sur l'ancien
  // match par nom pour les vues encore mockées, sans colonne is_default.
  const defaultView =
    savedViews.find((v) => v.isDefault) ?? savedViews.find((v) => v.name === "À traiter") ?? null

  const [filters, setFilters] = useState<BoardFilters>(() => viewToFilters(defaultView))
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null)
  const [localViews, setLocalViews] = useState<SavedView[]>([])
  const [sort, setSort] = useState<SortKey>("priority")
  const [mode, setMode] = useState<BoardViewMode>("list")

  // Mutations locales (aperçu) appliquées par-dessus les mocks.
  // Les étiquettes saisies (déjà résolues dans la locale) sont stockées comme
  // string via loc(s, s) pour rester compatibles avec le type ContentItem.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ContentStatus>>({})
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string[]>>({})
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, string>>({})
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set())

  // Suivi de validation : demande mockée, remplacée par un envoi local.
  const [localRequest, setLocalRequest] = useState<ReviewRequest | null>(null)
  const [reminders, setReminders] = useState(0)
  const request = localRequest ?? initialRequest

  /** Modification manuelle d'un filtre → la vue enregistrée n'est plus active. */
  const patchFilters = useCallback((patch: Partial<BoardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setActiveViewId(null)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setActiveViewId(null)
  }, [])

  const applyView = useCallback((view: SavedView | null) => {
    setFilters(viewToFilters(view))
    setActiveViewId(view?.id ?? null)
  }, [])

  const saveCurrentView = useCallback(
    (name: string, clientId: string) => {
      const view: SavedView = {
        id: nextLocalId("sv_local"),
        clientId,
        // Vue locale (aperçu) : nom saisi dans la locale active, dupliqué.
        name: loc(name, name),
        filters: { ...filters },
      }
      setLocalViews((prev) => [...prev, view])
      setActiveViewId(view.id)
    },
    [filters]
  )

  const setStatusBatch = useCallback((ids: string[], status: ContentStatus) => {
    setStatusOverrides((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = status
      return next
    })
  }, [])

  const setItemLabels = useCallback((id: string, labels: string[]) => {
    setLabelOverrides((prev) => ({ ...prev, [id]: labels.map((l) => loc(l, l)) }))
  }, [])

  const addLabelsBatch = useCallback(
    (ids: string[], labels: string[], current: Map<string, string[]>) => {
      setLabelOverrides((prev) => {
        const next = { ...prev }
        for (const id of ids) {
          const merged = [...new Set([...(current.get(id) ?? []), ...labels])]
          next[id] = merged.map((l) => loc(l, l))
        }
        return next
      })
    },
    []
  )

  /** Programmation échelonnée : start + i × gap (gap 0 = toutes les heures). */
  const scheduleBatch = useCallback(
    (ids: string[], startIso: string, gapDays: number) => {
      const start = new Date(startIso).getTime()
      const step = gapDays === 0 ? HOUR_GAP_MS : gapDays * DAY_MS
      setScheduleOverrides((prev) => {
        const next = { ...prev }
        ids.forEach((id, i) => {
          next[id] = new Date(start + i * step).toISOString()
        })
        return next
      })
      setStatusBatch(ids, "scheduled")
    },
    [setStatusBatch]
  )

  const archiveBatch = useCallback((ids: string[]) => {
    setHiddenIds((prev) => new Set([...prev, ...ids]))
  }, [])

  const sendReviewRequest = useCallback(
    (ids: string[], message: string, clientId: string) => {
      setStatusBatch(ids, "in_review")
      const trimmed = message.trim()
      setLocalRequest({
        id: nextLocalId("rr_local"),
        clientId,
        contentIds: ids,
        reviewerIds: reviewer ? [reviewer.id] : [],
        // Message local (aperçu) saisi dans la locale active, dupliqué.
        message: trimmed ? loc(trimmed, trimmed) : undefined,
        sentAt: nowIso(),
        state: "pending",
      })
      setReminders(0)
    },
    [reviewer, setStatusBatch]
  )

  const remind = useCallback(() => setReminders((n) => n + 1), [])

  /** Contenus avec mutations locales appliquées (corbeille du board exclue). */
  const boardItems = useMemo(
    () =>
      items
        .filter((it) => !hiddenIds.has(it.id))
        .map((it) => {
          const status = statusOverrides[it.id]
          const labels = labelOverrides[it.id]
          const scheduledAt = scheduleOverrides[it.id]
          if (status === undefined && labels === undefined && scheduledAt === undefined) return it
          return {
            ...it,
            status: status ?? it.status,
            labels: labels ?? it.labels,
            scheduledAt: scheduledAt ?? it.scheduledAt,
          }
        }),
    [items, hiddenIds, statusOverrides, labelOverrides, scheduleOverrides]
  )

  const filteredItems = useMemo(
    () =>
      sortItems(
        boardItems.filter((it) => matchesFilters(it, filters, locale)),
        sort
      ),
    [boardItems, filters, sort, locale]
  )

  return {
    filters,
    patchFilters,
    resetFilters,
    sort,
    setSort,
    mode,
    setMode,
    views: [...savedViews, ...localViews],
    activeViewId,
    applyView,
    saveCurrentView,
    boardItems,
    filteredItems,
    request,
    reviewer,
    reminders,
    remind,
    setStatusBatch,
    setItemLabels,
    addLabelsBatch,
    scheduleBatch,
    archiveBatch,
    sendReviewRequest,
  }
}

export type BoardState = ReturnType<typeof useBoardState>
