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
import type { ContentPillar, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { BoardFiltersPopover } from "./board-filters"
import type { BoardState } from "./board-state"
import { type BoardViewMode, SORT_LABELS, type SortKey } from "./board-types"

// Barre d'outils du board : recherche plein texte, filtres, tri et bascule
// Liste / Kanban. Compteur de résultats inclus (N sur M).

const SORT_KEYS: SortKey[] = ["priority", "scheduled", "created", "status"]

const MODES: { id: BoardViewMode; label: string; icon: typeof LayoutList }[] = [
  { id: "list", label: "Liste", icon: LayoutList },
  { id: "kanban", label: "Kanban", icon: SquareKanban },
]

function ModeSwitch({ mode, onMode }: { mode: BoardViewMode; onMode: (m: BoardViewMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Mode d'affichage"
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
          {m.label}
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
  const search = board.filters.search

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => board.patchFilters({ search: e.target.value })}
          placeholder="Rechercher titre, légende, étiquette…"
          aria-label="Rechercher dans les contenus"
          className="pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {search.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Effacer la recherche"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => board.patchFilters({ search: "" })}
          >
            <X />
          </Button>
        ) : null}
      </div>

      <BoardFiltersPopover board={board} platforms={platforms} pillars={pillars} labels={labels} />

      <Select value={board.sort} onValueChange={(v) => board.setSort(v as SortKey)}>
        <SelectTrigger size="sm" aria-label="Trier les contenus">
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="flex-1" />

      <span className="text-xs text-muted-foreground tabular-nums">
        {resultCount} contenu{resultCount > 1 ? "s" : ""}
        {resultCount !== totalCount ? ` sur ${totalCount}` : ""}
      </span>

      <ModeSwitch mode={board.mode} onMode={board.setMode} />
    </div>
  )
}
