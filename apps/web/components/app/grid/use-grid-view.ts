"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { setExcludeFromGrid } from "@/lib/actions/content"
import type { ContentFormat, ContentStatus } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import type { GridRatio, GridTileData } from "./grid-types"

// État de présentation de la grille : ratio, rendu final, filtres, bac à sable
// (masquages, covers), synchro mockée, mode démo prospect. Le retrait de grille
// d'un Reel (exclude_from_grid) est une propriété RÉELLE persistée, pas du sandbox.

const SYNC_DURATION_MS = 1000

export function useGridView(clientId: string) {
  const t = useT()
  const router = useRouter()
  const [ratio, setRatio] = useState<GridRatio>("3:4")
  const [finalRender, setFinalRender] = useState(false)
  const [selectionMode, setSelectionModeState] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ReadonlySet<ContentStatus>>(new Set())
  const [formatFilter, setFormatFilter] = useState<ReadonlySet<ContentFormat>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set())
  const [excludedOverrides, setExcludedOverrides] = useState<Record<string, boolean>>({})
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({})
  const [demoMode, setDemoMode] = useState(false)
  const [presentationOpen, setPresentationOpen] = useState(false)
  const [validationSent, setValidationSent] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState("il y a 2 h")
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    },
    []
  )

  function toggleIn<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
    const next = new Set(set)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    return next
  }

  function isExcluded(tile: GridTileData): boolean {
    return excludedOverrides[tile.id] ?? tile.excludedFromGrid ?? false
  }

  async function toggleExcluded(tile: GridTileData) {
    const next = !isExcluded(tile)
    setExcludedOverrides((prev) => ({ ...prev, [tile.id]: next }))
    const res = await setExcludeFromGrid({ clientId, contentId: tile.id, excluded: next })
    if (!res.ok) {
      setExcludedOverrides((prev) => ({ ...prev, [tile.id]: !next }))
      toast.error(t("grid.tiles.excludeError"))
      return
    }
    toast.info(
      next
        ? t("grid.tiles.excludeRemoved", { title: tile.title })
        : t("grid.tiles.excludeRestored", { title: tile.title }),
      { description: next ? t("grid.tiles.excludeRemovedDesc") : undefined }
    )
    router.refresh()
  }

  function hideTile(tile: GridTileData) {
    setHiddenIds((prev) => new Set(prev).add(tile.id))
    toast.info(`« ${tile.title} » masqué de l'aperçu (bac à sable)`, {
      description: "Le post réel n'est pas touché — « Réinitialiser la grille » pour le rétablir.",
    })
  }

  function setCover(tileId: string, url: string) {
    setCoverOverrides((prev) => ({ ...prev, [tileId]: url }))
  }

  function runSync(importedCount: number) {
    if (syncing) return
    setSyncing(true)
    syncTimer.current = setTimeout(() => {
      setSyncing(false)
      setLastSync("à l'instant")
      toast.success(
        `Feed à jour — ${importedCount} publication${importedCount > 1 ? "s" : ""} importée${importedCount > 1 ? "s" : ""} (aperçu)`,
        { description: "Aucun post publié hors Ocean détecté depuis la dernière synchro." }
      )
    }, SYNC_DURATION_MS)
  }

  /** Réinitialise le bac à sable : masquages et covers testées. Le retrait de
   *  grille (exclude_from_grid) est une propriété réelle persistée, pas touchée. */
  function resetSandbox() {
    setHiddenIds(new Set())
    setCoverOverrides({})
  }

  return {
    ratio,
    setRatio,
    finalRender,
    setFinalRender,
    selectionMode,
    setSelectionMode: (active: boolean) => setSelectionModeState(active),
    statusFilter,
    toggleStatus: (s: ContentStatus) => setStatusFilter((prev) => toggleIn(prev, s)),
    formatFilter,
    toggleFormat: (f: ContentFormat) => setFormatFilter((prev) => toggleIn(prev, f)),
    clearFilters: () => {
      setStatusFilter(new Set())
      setFormatFilter(new Set())
    },
    hiddenIds,
    hideTile,
    isExcluded,
    toggleExcluded,
    coverOverrides,
    setCover,
    demoMode,
    setDemoMode,
    presentationOpen,
    setPresentationOpen,
    validationSent,
    setValidationSent,
    syncing,
    lastSync,
    runSync,
    resetSandbox,
  }
}

export type GridViewState = ReturnType<typeof useGridView>
