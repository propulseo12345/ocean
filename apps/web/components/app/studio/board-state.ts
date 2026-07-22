"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { sendReviewRequest as sendReviewRequestAction } from "@/lib/actions/collaboration"
import { scheduleContentItem, trashContent } from "@/lib/actions/content"
import { applyStatusIntent } from "@/lib/actions/content-status"
import { addLabelsToContents, setContentLabels } from "@/lib/actions/labels"
import { hours, nowIso } from "@/lib/clock"
import type { ContentItem, ContentStatus, Reviewer, ReviewRequest, SavedView } from "@/lib/domain"
import { useLocale } from "@/lib/i18n"
import { type BoardFilters, type BoardViewMode, EMPTY_FILTERS, type SortKey } from "./board-types"
import { matchesFilters, sortItems } from "./board-utils"

// État du board studio : filtres, vues, tri, mode d'affichage + mutations en lot.
// Les mutations par LOT (barre de sélection, envoi en revue groupé) persistent
// réellement (Server Actions per-id, optimiste + rollback). Le kanban single-drag
// garde sa propre persistance (board-kanban.tsx) et n'utilise que les setters
// OPTIMISTES d'ici (setStatusBatch / scheduleBatch) — ne pas les faire persister,
// sous peine de double écriture.

const HOUR_GAP_MS = hours(1)
const DAY_MS = hours(24)

// Identifiants locaux stables (jamais Date.now() : déterministe, SSR-safe).
let localSeq = 0
function nextLocalId(prefix: string): string {
  localSeq += 1
  return `${prefix}_${localSeq}`
}

/** Résultat d'une mutation en lot : combien de contenus ont abouti / échoué. */
export interface BatchResult {
  ok: number
  failed: number
}

export interface BoardStateInput {
  clientId: string
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

export function useBoardState({
  clientId,
  items,
  savedViews,
  reviewer,
  initialRequest,
}: BoardStateInput) {
  const { locale } = useLocale()
  const router = useRouter()
  // Vue par défaut : la colonne is_default (données réelles) ; repli sur l'ancien
  // match par nom pour les vues encore mockées, sans colonne is_default.
  const defaultView =
    savedViews.find((v) => v.isDefault) ?? savedViews.find((v) => v.name === "À traiter") ?? null

  const [filters, setFilters] = useState<BoardFilters>(() => viewToFilters(defaultView))
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null)
  const [localViews, setLocalViews] = useState<SavedView[]>([])
  const [sort, setSort] = useState<SortKey>("priority")
  const [mode, setMode] = useState<BoardViewMode>("list")

  // Surcharges optimistes appliquées par-dessus les données serveur, réconciliées
  // au router.refresh() qui suit chaque écriture.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ContentStatus>>({})
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string[]>>({})
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, string>>({})
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set())

  // Suivi de validation : demande serveur (getReviewRequest) + surcouche locale
  // optimiste posée à l'envoi groupé (quand un reviewer accepté existe).
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
    (name: string, viewClientId: string): string => {
      // Optimiste : la vue apparaît tout de suite (persistée par l'appelant, qui
      // a accès à `t` pour les toasts). Renvoie l'id local pour un rollback.
      const localId = nextLocalId("sv_local")
      const view: SavedView = { id: localId, clientId: viewClientId, name, filters: { ...filters } }
      setLocalViews((prev) => [...prev, view])
      setActiveViewId(localId)
      return localId
    },
    [filters]
  )

  const dropLocalView = useCallback((localId: string) => {
    setLocalViews((prev) => prev.filter((v) => v.id !== localId))
    setActiveViewId((cur) => (cur === localId ? null : cur))
  }, [])

  // --- Setters OPTIMISTES purs (kanban single-drag + primitives internes) -----

  const setStatusBatch = useCallback((ids: string[], status: ContentStatus) => {
    setStatusOverrides((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = status
      return next
    })
  }, [])

  // Étiquettes d'une carte : optimiste + persistance (setContentLabels), rollback
  // vers l'état antérieur (override existant ou étiquettes serveur) si échec.
  const setItemLabels = useCallback(
    async (id: string, labels: string[]): Promise<boolean> => {
      const hadOverride = id in labelOverrides
      const prev = labelOverrides[id]
      setLabelOverrides((cur) => ({ ...cur, [id]: labels }))
      const res = await setContentLabels({ clientId, contentId: id, labels })
      if (!res.ok) {
        setLabelOverrides((cur) => {
          const next = { ...cur }
          if (hadOverride) next[id] = prev
          else delete next[id]
          return next
        })
        return false
      }
      router.refresh()
      return true
    },
    [clientId, labelOverrides, router]
  )

  // Étiquetage en lot : union optimiste + persistance (addLabelsToContents).
  const addLabelsBatch = useCallback(
    async (ids: string[], labels: string[], current: Map<string, string[]>): Promise<boolean> => {
      const snapshot = new Map(ids.map((id) => [id, labelOverrides[id]] as const))
      setLabelOverrides((prev) => {
        const next = { ...prev }
        for (const id of ids) {
          next[id] = [...new Set([...(current.get(id) ?? []), ...labels])]
        }
        return next
      })
      const res = await addLabelsToContents({ clientId, contentIds: ids, labels })
      if (!res.ok) {
        setLabelOverrides((cur) => {
          const next = { ...cur }
          for (const [id, prev] of snapshot) {
            if (prev === undefined) delete next[id]
            else next[id] = prev
          }
          return next
        })
        return false
      }
      router.refresh()
      return true
    },
    [clientId, labelOverrides, router]
  )

  /** Programmation échelonnée optimiste : start + i × gap (gap 0 = toutes les heures). */
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

  // --- Mutations en LOT persistées (barre de sélection, envoi en revue) --------
  // Chaque contenu du client est ciblé par son id ; org_id/rôle sont revérifiés
  // côté serveur (requireClientInOrg). Le statut de départ est relu en base par
  // applyStatusIntent — jamais reçu du client.

  /** Capture le statut effectif courant d'un lot (pour rollback). */
  const snapshotStatus = useCallback(
    (ids: string[]) => new Map(ids.map((id) => [id, statusOverrides[id]] as const)),
    [statusOverrides]
  )

  const rollbackStatus = useCallback(
    (snapshot: Map<string, ContentStatus | undefined>, failed: string[]) => {
      setStatusOverrides((cur) => {
        const next = { ...cur }
        for (const id of failed) {
          const prev = snapshot.get(id)
          if (prev === undefined) delete next[id]
          else next[id] = prev
        }
        return next
      })
    },
    []
  )

  const archiveBatch = useCallback(
    async (ids: string[]): Promise<BatchResult> => {
      setHiddenIds((prev) => new Set([...prev, ...ids]))
      const results = await Promise.all(
        ids.map((id) => trashContent({ clientId, contentId: id }))
      )
      const failed = ids.filter((_, i) => !results[i].ok)
      if (failed.length) {
        setHiddenIds((prev) => {
          const next = new Set(prev)
          for (const id of failed) next.delete(id)
          return next
        })
      }
      router.refresh()
      return { ok: ids.length - failed.length, failed: failed.length }
    },
    [clientId, router]
  )

  const cancelBatch = useCallback(
    async (ids: string[]): Promise<BatchResult> => {
      const snapshot = snapshotStatus(ids)
      setStatusBatch(ids, "canceled")
      const results = await Promise.all(
        ids.map((id) => applyStatusIntent({ clientId, contentId: id, intent: "cancel" }))
      )
      const failed = ids.filter((_, i) => !results[i].ok)
      rollbackStatus(snapshot, failed)
      router.refresh()
      return { ok: ids.length - failed.length, failed: failed.length }
    },
    [clientId, router, setStatusBatch, snapshotStatus, rollbackStatus]
  )

  const scheduleBatchCommit = useCallback(
    async (ids: string[], startIso: string, gapDays: number): Promise<BatchResult> => {
      const snapshot = snapshotStatus(ids)
      scheduleBatch(ids, startIso, gapDays) // optimiste : dates échelonnées + statut
      const start = new Date(startIso).getTime()
      const step = gapDays === 0 ? HOUR_GAP_MS : gapDays * DAY_MS
      const results = await Promise.all(
        ids.map(async (id, i) => {
          const s = await applyStatusIntent({ clientId, contentId: id, intent: "schedule" })
          if (!s.ok) return s
          const iso = new Date(start + i * step).toISOString()
          return scheduleContentItem({ clientId, contentId: id, scheduledAt: iso })
        })
      )
      const failed = ids.filter((_, i) => !results[i].ok)
      rollbackStatus(snapshot, failed)
      router.refresh()
      return { ok: ids.length - failed.length, failed: failed.length }
    },
    [clientId, router, scheduleBatch, snapshotStatus, rollbackStatus]
  )

  /**
   * Envoi en validation groupé. La TRANSITION (send_to_review) suffit à faire
   * apparaître les contenus dans le portail (statut in_review, RLS reviewer).
   * Le review_request (suivi + relances) n'est créé QUE si un reviewer accepté
   * existe : l'action collaboration exige recipientUserIds ≥ 1 (dépend de
   * l'acceptation d'invitation, Tier D). Sans reviewer, la transition est réelle,
   * le suivi de relance simplement absent.
   */
  const sendReviewRequest = useCallback(
    async (ids: string[], message: string): Promise<BatchResult> => {
      const snapshot = snapshotStatus(ids)
      setStatusBatch(ids, "in_review")
      const trimmed = message.trim()
      const results = await Promise.all(
        ids.map((id) => applyStatusIntent({ clientId, contentId: id, intent: "send_to_review" }))
      )
      const okIds = ids.filter((_, i) => results[i].ok)
      const failed = ids.filter((_, i) => !results[i].ok)
      rollbackStatus(snapshot, failed)

      if (reviewer && okIds.length) {
        await sendReviewRequestAction({
          clientId,
          contentItemIds: okIds,
          recipientUserIds: [reviewer.id],
          message: trimmed || null,
        })
        setLocalRequest({
          id: nextLocalId("rr_local"),
          clientId,
          contentIds: okIds,
          reviewerIds: [reviewer.id],
          message: trimmed ? trimmed : undefined,
          sentAt: nowIso(),
          state: "pending",
        })
        setReminders(0)
      }
      router.refresh()
      return { ok: okIds.length, failed: failed.length }
    },
    [clientId, reviewer, router, setStatusBatch, snapshotStatus, rollbackStatus]
  )

  const remind = useCallback(() => setReminders((n) => n + 1), [])

  /** Contenus avec surcharges optimistes appliquées (archivés du board exclus). */
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
    dropLocalView,
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
    cancelBatch,
    scheduleBatchCommit,
    archiveBatch,
    sendReviewRequest,
  }
}

export type BoardState = ReturnType<typeof useBoardState>
