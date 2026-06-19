"use client"

import { ArrowDownWideNarrow, ListFilter, Search, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LibraryAssetSource } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import {
  EMPTY_FILTERS,
  type LibraryFilters,
  SORT_LABELS,
  type SortKey,
  type TypeFilter,
  type UsageFilter,
} from "./library-types"
import { sourceMeta } from "./library-utils"

// Recherche + tri + chips de filtres (type, source, usage, conformité specs).

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
        pressed
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

const SORT_KEYS: SortKey[] = ["recent", "weight", "usage"]
const TYPES: Array<{ value: TypeFilter; label: string }> = [
  { value: "image", label: "Images" },
  { value: "video", label: "Vidéos" },
]
const SOURCES: LibraryAssetSource[] = ["upload", "depot_client", "import"]
const USAGES: Array<{ value: UsageFilter; label: string }> = [
  { value: "used", label: "Utilisés" },
  { value: "unused", label: "Inédits" },
]

export function LibraryToolbar({
  filters,
  sort,
  onFilters,
  onSort,
}: {
  filters: LibraryFilters
  sort: SortKey
  onFilters: (next: LibraryFilters) => void
  onSort: (key: SortKey) => void
}) {
  const set = (patch: Partial<LibraryFilters>) => onFilters({ ...filters, ...patch })
  const hasFilter =
    filters.type !== "all" ||
    filters.source !== "all" ||
    filters.usage !== "all" ||
    filters.specs !== "all" ||
    filters.search !== ""

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Rechercher (alt text, nom de fichier)…"
            aria-label="Rechercher un média"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownWideNarrow className="size-3.5 text-muted-foreground" aria-hidden />
          <Select value={sort} onValueChange={(value) => onSort(value as SortKey)}>
            <SelectTrigger size="sm" aria-label="Trier les médias">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ListFilter className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">Filtres de la médiathèque</span>

        {TYPES.map((t) => (
          <Chip
            key={t.value}
            pressed={filters.type === t.value}
            onClick={() => set({ type: filters.type === t.value ? "all" : t.value })}
          >
            {t.label}
          </Chip>
        ))}

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {SOURCES.map((s) => (
          <Chip
            key={s}
            pressed={filters.source === s}
            onClick={() => set({ source: filters.source === s ? "all" : s })}
          >
            {sourceMeta[s].label}
          </Chip>
        ))}

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {USAGES.map((u) => (
          <Chip
            key={u.value}
            pressed={filters.usage === u.value}
            onClick={() => set({ usage: filters.usage === u.value ? "all" : u.value })}
          >
            {u.label}
          </Chip>
        ))}

        <Chip
          pressed={filters.specs === "issues"}
          onClick={() => set({ specs: filters.specs === "issues" ? "all" : "issues" })}
        >
          Hors specs IG
        </Chip>

        {hasFilter ? (
          <Button variant="ghost" size="xs" onClick={() => onFilters(EMPTY_FILTERS)}>
            <X />
            Effacer
          </Button>
        ) : null}
      </div>
    </div>
  )
}
