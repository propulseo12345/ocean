"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AccountAlert } from "@/components/shared/account-alert"
import { useMultiSelect } from "@/hooks/use-multi-select"
import type { QuotaUsage, SocialAccount } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import type { CoverCompareTarget } from "./cover-compare-dialog"
import { DemoBanner } from "./demo-banner"
import { demoProspect } from "./demo-profile"
import { GridDialogs } from "./grid-dialogs"
import { GridEmptyState } from "./grid-empty-state"
import { GridFilters } from "./grid-filters"
import { GridSelectionBar } from "./grid-selection-bar"
import { GridToolbar } from "./grid-toolbar"
import { type GridTileData, isSortableTile, type PillarOption } from "./grid-types"
import {
  buildCoverTarget,
  FORMAT_ORDER,
  isFinalTile,
  makeMatchesFilters,
  makeWithCover,
  planExpiryImpact,
  STATUS_ORDER,
} from "./grid-visibility"
import { GridWorkspace } from "./grid-workspace"
import type { InstagramProfileData } from "./instagram-profile-header"
import { PendingBar } from "./pending-bar"
import type { QuickViewCtx } from "./tile-quick-view"
import { useGridTiles } from "./use-grid-tiles"
import { useGridView } from "./use-grid-view"

export function FeedGrid({
  profile,
  pinned,
  scheduled,
  published,
  imported,
  shelf,
  igAccount,
  quota,
  pillars,
  palette,
  reviewerName,
  clientId,
  tz,
}: {
  profile: InstagramProfileData
  pinned: GridTileData[]
  scheduled: GridTileData[]
  published: GridTileData[]
  imported: GridTileData[]
  shelf: GridTileData[]
  igAccount: SocialAccount | null
  quota: QuotaUsage | null
  pillars: PillarOption[]
  palette: string[]
  reviewerName: string | null
  clientId: string
  tz: string
}) {
  const t = useT()
  const tiles = useGridTiles(scheduled, shelf, tz, clientId, routes.clientContent(clientId))
  const view = useGridView()
  const select = useMultiSelect()
  const [validateOpen, setValidateOpen] = useState(false)
  const [coverTarget, setCoverTarget] = useState<CoverCompareTarget | null>(null)

  const withCover = makeWithCover(view.coverOverrides)
  const matchesFilters = makeMatchesFilters(view.statusFilter, view.formatFilter)

  const plannedVisible = tiles.planned
    .map(withCover)
    .filter((t) => !view.isExcluded(t))
    .filter((t) => (view.finalRender ? isFinalTile(t) : true))
    .filter(matchesFilters)

  const lockedVisible = (list: GridTileData[]) =>
    list
      .map(withCover)
      .filter((t) => !view.hiddenIds.has(t.id) && !view.isExcluded(t))
      .filter(matchesFilters)

  const pinnedVisible = lockedVisible(pinned)
  const publishedVisible = lockedVisible(published)
  const importedVisible = lockedVisible(imported)
  const allVisible = [...pinnedVisible, ...plannedVisible, ...publishedVisible, ...importedVisible]

  // Quand un filtre masque une tuile sélectionnée, on l'élague de la sélection :
  // pas d'action par lot sur une tuile invisible. Clé stable = ids visibles triés.
  const visibleKey = allVisible
    .map((t) => t.id)
    .sort()
    .join("|")
  useEffect(() => {
    const visible = new Set(visibleKey ? visibleKey.split("|") : [])
    const pruned = select.selectedIds.filter((id) => visible.has(id))
    if (pruned.length !== select.selectedIds.length) select.selectAll(pruned)
  }, [visibleKey, select.selectedIds, select.selectAll])

  const excludedReels = [...tiles.planned, ...pinned, ...published]
    .map(withCover)
    .filter((t) => t.format === "reel" && view.isExcluded(t))
  const reels = [...tiles.planned, ...pinned, ...published, ...imported]
    .map(withCover)
    .filter((t) => t.format === "reel" && !t.ghost)
  const sortablePlanned = tiles.planned.filter((t) => isSortableTile(t) && !t.ghost)

  const allTiles = [...tiles.planned, ...pinned, ...published, ...imported]
  const statuses = STATUS_ORDER.filter((s) => allTiles.some((t) => t.status === s))
  const formats = FORMAT_ORDER.filter((f) => allTiles.some((t) => t.format === f))

  const ctx: QuickViewCtx = {
    pillars: Object.fromEntries(
      pillars.map((p) => [p.id, { label: p.label, colorVar: p.colorVar }])
    ),
    isExcluded: view.isExcluded,
    onToggleExcluded: view.toggleExcluded,
    onCompareCover: (tile) => setCoverTarget(buildCoverTarget(tile, withCover(tile), allVisible)),
    onInsertSlot: tiles.insertSlotBefore,
    onHide: view.hideTile,
    onRetry: tiles.retryTile,
    onRecycle: (tile) =>
      toast.info(t("grid.feed.recycleToast", { title: tile.title }), {
        description: t("grid.feed.recycleToastDescription"),
      }),
  }

  function resetAll() {
    tiles.resetTiles()
    view.resetSandbox()
    select.clear()
    toast.success(t("grid.feed.resetToast"), {
      description: t("grid.feed.resetToastDescription"),
    })
  }

  // Quitter le mode sélection vide la sélection en cours.
  const toolbarView = {
    ...view,
    setSelectionMode: (active: boolean) => {
      view.setSelectionMode(active)
      if (!active) select.clear()
    },
  }

  if (allTiles.length === 0 && tiles.shelf.length === 0) {
    return <GridEmptyState clientId={clientId} />
  }

  const profileToShow: InstagramProfileData = view.demoMode
    ? { ...profile, ...demoProspect(t), avatarUrl: "" }
    : profile

  return (
    <div className="space-y-4">
      {igAccount && igAccount.status !== "connected" ? (
        <AccountAlert account={igAccount} impact={planExpiryImpact(sortablePlanned.length)} />
      ) : null}

      <GridToolbar
        view={toolbarView}
        quota={quota}
        pillars={pillars}
        importedCount={imported.length}
        plannedCount={sortablePlanned.length}
        onOpenValidation={() => setValidateOpen(true)}
        onAddPlaceholder={tiles.addPlaceholder}
        onResetAll={resetAll}
      />

      {view.demoMode ? <DemoBanner onQuit={() => view.setDemoMode(false)} /> : null}

      {view.finalRender ? null : (
        <GridFilters
          statuses={statuses}
          formats={formats}
          view={view}
          excludedReels={excludedReels}
          hiddenCount={view.hiddenIds.size}
          onRestoreHidden={view.resetSandbox}
        />
      )}

      {view.finalRender ? null : (
        <PendingBar
          count={tiles.pendingCount}
          onApply={tiles.applyPending}
          onUndo={tiles.undoLast}
          onRevert={tiles.revertAll}
        />
      )}

      <GridWorkspace
        profile={profileToShow}
        tz={tz}
        palette={palette}
        reels={reels}
        pinned={pinnedVisible}
        planned={plannedVisible}
        published={publishedVisible}
        imported={importedVisible}
        ratio={view.ratio}
        finalRender={view.finalRender}
        syncing={view.syncing}
        isExcluded={view.isExcluded}
        ctx={ctx}
        selection={{
          active: view.selectionMode,
          isSelected: select.isSelected,
          onToggle: select.toggle,
        }}
        tiles={tiles}
      />

      {view.selectionMode ? (
        <GridSelectionBar
          selectedIds={select.selectedIds}
          onClear={select.clear}
          onSendReview={tiles.batchSendReview}
          onShiftWeek={tiles.batchShiftWeek}
          onCancel={tiles.batchCancel}
        />
      ) : null}

      <GridDialogs
        view={view}
        validateOpen={validateOpen}
        onValidateOpenChange={setValidateOpen}
        plannedCount={sortablePlanned.length}
        reviewerName={reviewerName}
        coverTarget={coverTarget}
        onCloseCover={() => setCoverTarget(null)}
        profile={profileToShow}
        presentationTiles={[
          ...pinnedVisible,
          ...plannedVisible.filter(isFinalTile),
          ...publishedVisible,
          ...importedVisible,
        ]}
      />
    </div>
  )
}
