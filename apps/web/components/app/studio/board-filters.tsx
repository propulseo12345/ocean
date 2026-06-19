"use client"

import { ListFilter } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { contentStatusMeta, formatMeta, platformMeta } from "@/lib/mocks/labels"
import type { ContentFormat, ContentPillar, ContentStatus, Platform } from "@/lib/mocks/types"
import type { BoardState } from "./board-state"
import { labelColorVar, STATUS_ORDER } from "./board-types"
import { countActiveFilters } from "./board-utils"

// Filtres multi-sélection du board : statut (les 11, y compris idée/annulé),
// plateforme, format, pilier éditorial et étiquettes.

const FORMATS: ContentFormat[] = ["post", "carousel", "reel", "story"]

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{title}</legend>
      <div className="flex flex-col gap-1">{children}</div>
    </fieldset>
  )
}

function FilterOption({
  checked,
  onToggle,
  children,
}: {
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm font-normal hover:bg-muted/60">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {children}
    </Label>
  )
}

export function BoardFiltersPopover({
  board,
  platforms,
  pillars,
  labels,
}: {
  board: BoardState
  platforms: Platform[]
  pillars: ContentPillar[]
  labels: string[]
}) {
  const f = board.filters
  const count = countActiveFilters(f)

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilter />
        Filtres
        {count > 0 ? <Badge className="ml-0.5 h-4 min-w-4 px-1 tabular-nums">{count}</Badge> : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Filtrer les contenus</p>
          {count > 0 ? (
            <Button variant="link" size="xs" className="h-auto p-0" onClick={board.resetFilters}>
              Réinitialiser
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <FilterGroup title="Statut">
            {STATUS_ORDER.map((s: ContentStatus) => (
              <FilterOption
                key={s}
                checked={f.statuses.includes(s)}
                onToggle={() => board.patchFilters({ statuses: toggleValue(f.statuses, s) })}
              >
                {contentStatusMeta[s].label}
              </FilterOption>
            ))}
          </FilterGroup>

          <div className="space-y-3">
            <FilterGroup title="Plateforme">
              {platforms.map((p) => (
                <FilterOption
                  key={p}
                  checked={f.platforms.includes(p)}
                  onToggle={() => board.patchFilters({ platforms: toggleValue(f.platforms, p) })}
                >
                  <PlatformIcon platform={p} className="size-3.5" />
                  {platformMeta[p].label}
                </FilterOption>
              ))}
            </FilterGroup>

            <FilterGroup title="Format">
              {FORMATS.map((fmt) => (
                <FilterOption
                  key={fmt}
                  checked={f.formats.includes(fmt)}
                  onToggle={() => board.patchFilters({ formats: toggleValue(f.formats, fmt) })}
                >
                  {formatMeta[fmt].label}
                </FilterOption>
              ))}
            </FilterGroup>
          </div>
        </div>

        {pillars.length > 0 ? (
          <FilterGroup title="Pilier éditorial">
            {pillars.map((p) => (
              <FilterOption
                key={p.id}
                checked={f.pillarIds.includes(p.id)}
                onToggle={() => board.patchFilters({ pillarIds: toggleValue(f.pillarIds, p.id) })}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.colorVar }}
                />
                {p.name}
              </FilterOption>
            ))}
          </FilterGroup>
        ) : null}

        {labels.length > 0 ? (
          <FilterGroup title="Étiquette">
            {labels.map((label) => (
              <FilterOption
                key={label}
                checked={f.labels.includes(label)}
                onToggle={() => board.patchFilters({ labels: toggleValue(f.labels, label) })}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: labelColorVar(label) }}
                />
                {label}
              </FilterOption>
            ))}
          </FilterGroup>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
