"use client"

import { ArrowUpDown, LayoutList, Search, SquareKanban, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ContentPillar, Platform } from "@/lib/domain"
import { type Translator, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { BoardFiltersPopover } from "./board-filters"
import type { BoardState } from "./board-state"
import { type BoardViewMode, SORT_LABEL_KEYS, type SortKey } from "./board-types"

// Barre d'outils du board : recherche plein texte, filtres, tri et bascule
// Liste / Kanban. Compteur de résultats inclus (N sur M).

const SORT_KEYS: SortKey[] = ["priority", "scheduled", "created", "status"]

const MODES: {
  id: BoardViewMode
  labelKey: "studio.toolbar.modeList" | "studio.toolbar.modeKanban"
  icon: typeof LayoutList
}[] = [
  { id: "list", labelKey: "studio.toolbar.modeList", icon: LayoutList },
  { id: "kanban", labelKey: "studio.toolbar.modeKanban", icon: SquareKanban },
]

function ModeSwitch({
  mode,
  onMode,
  t,
}: {
  mode: BoardViewMode
  onMode: (m: BoardViewMode) => void
  t: Translator
}) {
  return (
    <div
      role="group"
      aria-label={t("studio.toolbar.modeGroup")}
      className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={mode === m.id}
          onClick={() => onMode(m.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === m.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <m.icon className="size-3.5" />
          {t(m.labelKey)}
        </button>
      ))}
    </div>
  )
}

export function BoardToolbar({
  board,
  platforms,
  pillars,
  labels,
  resultCount,
  totalCount,
}: {
  board: BoardState
  platforms: Platform[]
  pillars: ContentPillar[]
  labels: string[]
  resultCount: number
  totalCount: number
}) {
  const t = useT()
  const search = board.filters.search

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => board.patchFilters({ search: e.target.value })}
          placeholder={t("studio.toolbar.searchPlaceholder")}
          aria-label={t("studio.toolbar.searchAria")}
          className="pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {search.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("studio.toolbar.clearSearch")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => board.patchFilters({ search: "" })}
          >
            <X />
          </Button>
        ) : null}
      </div>

      <BoardFiltersPopover board={board} platforms={platforms} pillars={pillars} labels={labels} />

      <Select value={board.sort} onValueChange={(v) => board.setSort(v as SortKey)}>
        <SelectTrigger size="sm" aria-label={t("studio.toolbar.sortAria")}>
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {t(SORT_LABEL_KEYS[key])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="flex-1" />

      <span className="text-xs text-muted-foreground tabular-nums">
        {resultCount === totalCount
          ? t("studio.toolbar.resultCount", { count: resultCount })
          : t("studio.toolbar.resultCountOf", { count: resultCount, total: totalCount })}
      </span>

      <ModeSwitch mode={board.mode} onMode={board.setMode} t={t} />
    </div>
  )
}
