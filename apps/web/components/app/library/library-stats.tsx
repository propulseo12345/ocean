"use client"

import type { LucideIcon } from "lucide-react"
import { CircleAlert, Images, Inbox, Sparkles } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { LibraryFilters, LibraryStatsData } from "./library-types"

// Compteurs d'en-tête cliquables : chaque chip applique le filtre correspondant.

function StatChip({
  icon: Icon,
  count,
  label,
  pressed,
  tone,
  onClick,
}: {
  icon: LucideIcon
  count: number
  label: string
  pressed: boolean
  tone?: "info" | "success" | "danger"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        pressed
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          !pressed && tone === "info" && "text-info",
          !pressed && tone === "success" && "text-success",
          !pressed && tone === "danger" && "text-destructive"
        )}
        aria-hidden
      />
      <span className="tabular-nums">{count}</span>
      {label}
    </button>
  )
}

export function LibraryStats({
  stats,
  filters,
  onResetFilters,
  onToggleUnused,
  onToggleDeposit,
  onToggleOffSpec,
}: {
  stats: LibraryStatsData
  filters: LibraryFilters
  onResetFilters: () => void
  onToggleUnused: () => void
  onToggleDeposit: () => void
  onToggleOffSpec: () => void
}) {
  const t = useT()
  const noFilter =
    filters.type === "all" &&
    filters.source === "all" &&
    filters.usage === "all" &&
    filters.specs === "all" &&
    filters.search === ""

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatChip
        icon={Images}
        count={stats.total}
        label={t("library.stats.total", { count: stats.total })}
        pressed={noFilter}
        onClick={onResetFilters}
      />
      <StatChip
        icon={Sparkles}
        count={stats.unused}
        label={t("library.stats.unused", { count: stats.unused })}
        pressed={filters.usage === "unused"}
        tone="success"
        onClick={onToggleUnused}
      />
      <StatChip
        icon={Inbox}
        count={stats.deposit}
        label={t("library.stats.deposit", { count: stats.deposit })}
        pressed={filters.source === "depot_client"}
        tone="info"
        onClick={onToggleDeposit}
      />
      <StatChip
        icon={CircleAlert}
        count={stats.offSpec}
        label={t("library.stats.offSpec")}
        pressed={filters.specs === "issues"}
        tone="danger"
        onClick={onToggleOffSpec}
      />
    </div>
  )
}
