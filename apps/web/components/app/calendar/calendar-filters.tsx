"use client"

import { ChevronDown, ListFilter, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLabels, useT } from "@/lib/i18n"
import { contentStatusMeta, formatLabelKey, platformMeta } from "@/lib/mocks/labels"
import type { ContentFormat, ContentPillar, ContentStatus, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { type CalendarFilters, hasActiveFilters } from "./calendar-types"

// Barre de filtres combinables (statut · plateforme · format · pilier) avec
// compteur de résultats. Les filtres persistent en changeant de période.

const ALL_STATUSES = Object.keys(contentStatusMeta) as ContentStatus[]
const ALL_PLATFORMS = Object.keys(platformMeta) as Platform[]
const ALL_FORMATS = Object.keys(formatLabelKey) as ContentFormat[]

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterMenu({
  label,
  selectedCount,
  children,
}: {
  label: string
  selectedCount: number
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(selectedCount > 0 && "border-primary/50 text-primary")}
          />
        }
      >
        {label}
        {selectedCount > 0 ? <span className="tabular-nums">({selectedCount})</span> : null}
        <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CalendarFiltersBar({
  filters,
  onChange,
  onClear,
  pillars,
  visibleCount,
  maskedCount,
}: {
  filters: CalendarFilters
  onChange: (f: CalendarFilters) => void
  onClear: () => void
  pillars: ContentPillar[]
  visibleCount: number
  maskedCount: number
}) {
  const t = useT()
  const lbl = useLabels()
  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ListFilter className="size-4 text-muted-foreground" aria-hidden />

      <FilterMenu label={t("calendar.filters.status")} selectedCount={filters.statuses.length}>
        {ALL_STATUSES.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={filters.statuses.includes(s)}
            onCheckedChange={() =>
              onChange({ ...filters, statuses: toggleValue(filters.statuses, s) })
            }
            closeOnClick={false}
          >
            {lbl.contentStatus(s)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      <FilterMenu label={t("calendar.filters.platform")} selectedCount={filters.platforms.length}>
        {ALL_PLATFORMS.map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={filters.platforms.includes(p)}
            onCheckedChange={() =>
              onChange({ ...filters, platforms: toggleValue(filters.platforms, p) })
            }
            closeOnClick={false}
          >
            {lbl.platform(p)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      <FilterMenu label={t("calendar.filters.format")} selectedCount={filters.formats.length}>
        {ALL_FORMATS.map((f) => (
          <DropdownMenuCheckboxItem
            key={f}
            checked={filters.formats.includes(f)}
            onCheckedChange={() =>
              onChange({ ...filters, formats: toggleValue(filters.formats, f) })
            }
            closeOnClick={false}
          >
            {lbl.format(f)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      {pillars.length > 0 ? (
        <FilterMenu label={t("calendar.filters.pillar")} selectedCount={filters.pillarIds.length}>
          {pillars.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={filters.pillarIds.includes(p.id)}
              onCheckedChange={() =>
                onChange({ ...filters, pillarIds: toggleValue(filters.pillarIds, p.id) })
              }
              closeOnClick={false}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.colorVar }}
                aria-hidden
              />
              {p.name}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterMenu>
      ) : null}

      {active ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X data-icon="inline-start" />
          {t("calendar.filters.clear")}
        </Button>
      ) : null}

      <p className="ml-auto text-xs text-muted-foreground tabular-nums">
        {t("calendar.filters.counts", {
          count: visibleCount,
          masked: active ? maskedCount : 0,
        })}
      </p>
    </div>
  )
}
