"use client"

import { FolderOpen, Inbox } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { useT } from "@/lib/i18n"
import type { LibraryAsset } from "@/lib/mocks/types"
import type { SpecIssue } from "@/lib/specs"
import { AssetCard } from "./asset-card"

// Grille responsive des assets, avec section « Reçus du client » mise en
// avant (résultat du lien de dépôt) quand aucun filtre de source n'isole déjà.

interface CardContext {
  issuesById: ReadonlyMap<string, SpecIssue[]>
  tz: string
  selectMode: boolean
  isSelected: (id: string) => boolean
  onOpen: (asset: LibraryAsset) => void
  onToggleSelect: (id: string) => void
}

function Cards({ assets, ctx }: { assets: LibraryAsset[]; ctx: CardContext }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => (
        <li key={asset.id}>
          <AssetCard
            asset={asset}
            issues={ctx.issuesById.get(asset.id) ?? []}
            tz={ctx.tz}
            selectMode={ctx.selectMode}
            selected={ctx.isSelected(asset.id)}
            onOpen={ctx.onOpen}
            onToggleSelect={ctx.onToggleSelect}
          />
        </li>
      ))}
    </ul>
  )
}

export function AssetGrid({
  deposit,
  others,
  splitDeposit,
  filtered,
  ctx,
}: {
  /** Assets « Reçus du client » (source depot_client), déjà filtrés/triés. */
  deposit: LibraryAsset[]
  /** Les autres assets, déjà filtrés/triés. */
  others: LibraryAsset[]
  /** Mettre la section dépôt en avant (aucun filtre de source actif). */
  splitDeposit: boolean
  /** Au moins un filtre ou une recherche est actif. */
  filtered: boolean
  ctx: CardContext
}) {
  const t = useT()
  const total = deposit.length + others.length

  if (total === 0) {
    return (
      <EmptyState
        icon={filtered ? FolderOpen : Inbox}
        title={filtered ? t("library.grid.emptyFilteredTitle") : t("library.grid.emptyTitle")}
        description={
          filtered ? t("library.grid.emptyFilteredDesc") : t("library.grid.emptyDesc")
        }
      />
    )
  }

  if (!splitDeposit || deposit.length === 0) {
    return <Cards assets={[...deposit, ...others]} ctx={ctx} />
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-xl border border-info/30 bg-info/[0.04] p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Inbox className="size-4 text-info" aria-hidden />
          <h3 className="text-sm font-medium">{t("library.grid.depositSection")}</h3>
          <span className="text-xs text-muted-foreground">
            {t("library.grid.depositCount", { count: deposit.length })}
          </span>
        </div>
        <Cards assets={deposit} ctx={ctx} />
      </section>

      {others.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{t("library.grid.allMedia")}</h3>
          <Cards assets={others} ctx={ctx} />
        </section>
      ) : null}
    </div>
  )
}
