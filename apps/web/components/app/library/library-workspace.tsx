"use client"

import { ImagePlus, Link2, SquareDashedMousePointer } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useMultiSelect } from "@/hooks/use-multi-select"
import type { Client, LibraryAsset } from "@/lib/mocks/types"
import type { SpecIssue } from "@/lib/specs"
import { AssetGrid } from "./asset-grid"
import { AssetSheet } from "./asset-sheet"
import { DeleteAssetDialog } from "./delete-asset-dialog"
import { DepositLinkDialog } from "./deposit-link-dialog"
import { LibrarySelectionBar } from "./library-selection-bar"
import { LibraryStats } from "./library-stats"
import { LibraryToolbar } from "./library-toolbar"
import {
  type ContentRefMap,
  EMPTY_FILTERS,
  type LibraryFilters,
  type SortKey,
  type UsageRef,
} from "./library-types"
import { assetIssues, hasSpecErrors, matchesFilters, sortAssets } from "./library-utils"
import { UploadDialog } from "./upload-dialog"
import { useLibraryAssets } from "./use-library-assets"

// Racine client de la médiathèque : état des filtres, sélection multiple,
// fiche asset, upload simulé et lien de dépôt client.

export function LibraryWorkspace({
  client,
  initialAssets,
  contentRefs,
}: {
  client: Client
  initialAssets: LibraryAsset[]
  contentRefs: ContentRefMap
}) {
  const lib = useLibraryAssets(client, initialAssets)
  const select = useMultiSelect()
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>("recent")
  const [selectMode, setSelectMode] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryAsset | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)

  const issuesById = useMemo(() => {
    const map = new Map<string, SpecIssue[]>()
    for (const a of lib.assets) map.set(a.id, assetIssues(a))
    return map
  }, [lib.assets])

  const visible = useMemo(() => {
    const list = lib.assets.filter((a) =>
      matchesFilters(a, filters, hasSpecErrors(issuesById.get(a.id) ?? []))
    )
    return sortAssets(list, sort)
  }, [lib.assets, filters, sort, issuesById])

  const deposit = visible.filter((a) => a.source === "depot_client")
  const others = visible.filter((a) => a.source !== "depot_client")
  const isFiltered =
    filters.search !== "" ||
    filters.type !== "all" ||
    filters.source !== "all" ||
    filters.usage !== "all" ||
    filters.specs !== "all"

  const stats = useMemo(
    () => ({
      total: lib.assets.length,
      unused: lib.assets.filter((a) => a.usedInContentIds.length === 0).length,
      deposit: lib.assets.filter((a) => a.source === "depot_client").length,
      offSpec: lib.assets.filter((a) => hasSpecErrors(issuesById.get(a.id) ?? [])).length,
    }),
    [lib.assets, issuesById]
  )

  const sheetAsset = sheetId !== null ? (lib.assets.find((a) => a.id === sheetId) ?? null) : null
  const usagesOf = (asset: LibraryAsset): UsageRef[] =>
    asset.usedInContentIds
      .map((id) => contentRefs[id])
      .filter((u): u is UsageRef => u !== undefined)

  function toggleSelectMode() {
    if (selectMode) select.clear()
    setSelectMode(!selectMode)
  }

  function doDelete(asset: LibraryAsset) {
    lib.removeAssets([asset.id])
    setDeleteTarget(null)
    if (sheetId === asset.id) setSheetId(null)
    toast.success("Média supprimé (aperçu)")
  }

  function requestDelete(asset: LibraryAsset) {
    if (asset.usedInContentIds.length > 0) setDeleteTarget(asset)
    else doDelete(asset)
  }

  function batchDelete(ids: string[]) {
    const selected = lib.assets.filter((a) => ids.includes(a.id))
    const removable = selected.filter((a) => a.usedInContentIds.length === 0)
    const keptCount = selected.length - removable.length
    select.clear()
    if (removable.length === 0) {
      toast.warning("Aucun média supprimé", {
        description: "Tous les médias sélectionnés sont utilisés dans des contenus.",
      })
      return
    }
    lib.removeAssets(removable.map((a) => a.id))
    toast.success(
      `${removable.length} média${removable.length > 1 ? "s" : ""} supprimé${removable.length > 1 ? "s" : ""} (aperçu)`,
      {
        description:
          keptCount > 0
            ? `${keptCount} conservé${keptCount > 1 ? "s" : ""} : utilisé${keptCount > 1 ? "s" : ""} dans des contenus.`
            : undefined,
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="font-heading text-lg font-semibold">Médiathèque</h2>
          <p className="text-sm text-muted-foreground">
            La banque de médias de {client.name} — le composer pioche dedans sans re-upload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            aria-pressed={selectMode}
            onClick={toggleSelectMode}
          >
            <SquareDashedMousePointer />
            Sélectionner
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDepositOpen(true)}>
            <Link2 />
            Lien de dépôt client
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <ImagePlus />
            Ajouter des médias
          </Button>
        </div>
      </div>

      <LibraryStats
        stats={stats}
        filters={filters}
        onResetFilters={() => setFilters(EMPTY_FILTERS)}
        onToggleUnused={() =>
          setFilters({ ...filters, usage: filters.usage === "unused" ? "all" : "unused" })
        }
        onToggleDeposit={() =>
          setFilters({
            ...filters,
            source: filters.source === "depot_client" ? "all" : "depot_client",
          })
        }
        onToggleOffSpec={() =>
          setFilters({ ...filters, specs: filters.specs === "issues" ? "all" : "issues" })
        }
      />

      <LibraryToolbar filters={filters} sort={sort} onFilters={setFilters} onSort={setSort} />

      <AssetGrid
        deposit={deposit}
        others={others}
        splitDeposit={filters.source === "all"}
        filtered={isFiltered}
        ctx={{
          issuesById,
          tz: client.timezone,
          selectMode,
          isSelected: select.isSelected,
          onOpen: (asset) => setSheetId(asset.id),
          onToggleSelect: select.toggle,
        }}
      />

      {selectMode ? (
        <LibrarySelectionBar
          selectedIds={select.selectedIds}
          onClear={select.clear}
          onDownload={(ids) =>
            toast.info(`${ids.length} média${ids.length > 1 ? "s" : ""} en téléchargement (aperçu)`)
          }
          onTag={(ids) =>
            toast.info("Étiquettes (aperçu)", {
              description: `Les tags libres arriveront ici pour ${ids.length} média${ids.length > 1 ? "s" : ""}.`,
            })
          }
          onDelete={batchDelete}
        />
      ) : null}

      <AssetSheet
        asset={sheetAsset}
        issues={sheetAsset ? (issuesById.get(sheetAsset.id) ?? []) : []}
        usages={sheetAsset ? usagesOf(sheetAsset) : []}
        clientId={client.id}
        tz={client.timezone}
        onClose={() => setSheetId(null)}
        onSaveAlt={lib.updateAltText}
        onDelete={requestDelete}
      />

      <DeleteAssetDialog
        asset={deleteTarget}
        usages={deleteTarget ? usagesOf(deleteTarget) : []}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
      />

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSimulate={lib.addMockAssets} />

      <DepositLinkDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        clientName={client.name}
        clientHandle={client.handle}
        receivedCount={stats.deposit}
        onShowReceived={() => setFilters({ ...EMPTY_FILTERS, source: "depot_client" })}
      />
    </div>
  )
}
