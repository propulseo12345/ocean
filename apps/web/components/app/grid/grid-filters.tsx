"use client"

import { EyeOff, Film, ListFilter, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { ContentFormat, ContentStatus } from "@/lib/domain"
import { contentStatusMeta, toneDotClass } from "@/lib/domain/labels"
import { useLabels, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridTileData } from "./grid-types"
import type { GridViewState } from "./use-grid-view"

// Filtres de la grille (statut, format) + compteurs du bac à sable :
// reels hors grille (réactivables) et tuiles masquées de l'aperçu.

function Chip({
  pressed,
  onClick,
  children,
  title,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        pressed
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export function GridFilters({
  statuses,
  formats,
  view,
  excludedReels,
  hiddenCount,
  onRestoreHidden,
}: {
  statuses: ContentStatus[]
  formats: ContentFormat[]
  view: GridViewState
  excludedReels: GridTileData[]
  hiddenCount: number
  onRestoreHidden: () => void
}) {
  const t = useT()
  const lbl = useLabels()
  const hasFilter = view.statusFilter.size > 0 || view.formatFilter.size > 0

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ListFilter className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("grid.filters.label")}</span>

      {statuses.map((s) => (
        <Chip key={s} pressed={view.statusFilter.has(s)} onClick={() => view.toggleStatus(s)}>
          <span className={cn("size-2 rounded-full", toneDotClass[contentStatusMeta[s].tone])} />
          {lbl.contentStatus(s)}
        </Chip>
      ))}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {formats.map((f) => (
        <Chip key={f} pressed={view.formatFilter.has(f)} onClick={() => view.toggleFormat(f)}>
          {lbl.format(f)}
        </Chip>
      ))}

      {hasFilter ? (
        <Button variant="ghost" size="xs" onClick={view.clearFilters}>
          <X />
          {t("grid.filters.clear")}
        </Button>
      ) : null}

      <span className="ml-auto flex items-center gap-1.5">
        {excludedReels.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Film className="size-3" />
              {t("grid.filters.reelsOffGrid", { count: excludedReels.length })}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="text-xs text-muted-foreground">{t("grid.filters.reelsOffGridHint")}</p>
              <ul className="space-y-1.5">
                {excludedReels.map((tile) => (
                  <li key={tile.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{tile.title}</span>
                    <Switch
                      size="sm"
                      checked={false}
                      onCheckedChange={() => view.toggleExcluded(tile)}
                      aria-label={t("grid.filters.showAgain", { title: tile.title })}
                    />
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : null}

        {hiddenCount > 0 ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground">
            <EyeOff className="size-3" />
            {t("grid.filters.hidden", { count: hiddenCount })}
            <button
              type="button"
              onClick={onRestoreHidden}
              className="font-medium text-primary hover:underline"
            >
              {t("grid.filters.restore")}
            </button>
          </span>
        ) : null}
      </span>
    </div>
  )
}
