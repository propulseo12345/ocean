"use client"

import {
  CalendarOff,
  ChartPie,
  Download,
  Info,
  PartyPopper,
  SquareCheckBig,
  Workflow,
} from "lucide-react"
import { QuotaGauge } from "@/components/shared/quota-gauge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { QuotaUsage } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import type { PillarMixRow } from "./calendar-insights"
import { PillarMixPanel } from "./pillar-mix-panel"

// Seconde rangée d'outils : compteurs de cadence, jauge quota IG, calques
// (marronniers, légende), mode sélection, mix de piliers, exports, règles.

export function CalendarControls({
  monthPostCount,
  gapCount,
  shelfCount,
  igQuota,
  showMarronniers,
  onToggleMarronniers,
  legendOpen,
  onToggleLegend,
  selectionMode,
  onToggleSelection,
  mixRows,
  onOpenExport,
  onOpenAutomations,
}: {
  monthPostCount: number
  gapCount: number
  shelfCount: number
  igQuota: QuotaUsage | null
  showMarronniers: boolean
  onToggleMarronniers: (v: boolean) => void
  legendOpen: boolean
  onToggleLegend: () => void
  selectionMode: boolean
  onToggleSelection: () => void
  mixRows: PillarMixRow[]
  onOpenExport: () => void
  onOpenAutomations: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-xs text-muted-foreground tabular-nums">
        {monthPostCount} post{monthPostCount > 1 ? "s" : ""} ce mois
      </p>
      {gapCount > 0 ? (
        <p
          className="flex items-center gap-1 text-xs font-medium text-warning tabular-nums"
          title="Périodes de plus de 4 jours sans publication planifiée"
        >
          <CalendarOff className="size-3.5" aria-hidden />
          {gapCount} trou{gapCount > 1 ? "s" : ""} de cadence
        </p>
      ) : null}
      {shelfCount > 0 ? (
        <p className="text-xs text-muted-foreground tabular-nums">{shelfCount} à planifier</p>
      ) : null}
      {igQuota ? (
        <div
          className="flex min-w-28 items-center gap-1.5"
          title="Quota Instagram du compte (24 h glissantes)"
        >
          <QuotaGauge usage={igQuota} className="w-28" />
        </div>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <PartyPopper className="size-3.5" aria-hidden />
          Marronniers
          <Switch
            size="sm"
            checked={showMarronniers}
            onCheckedChange={onToggleMarronniers}
            aria-label="Afficher les marronniers"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          aria-pressed={legendOpen}
          onClick={onToggleLegend}
          className={cn(legendOpen && "bg-muted text-foreground")}
        >
          <Info data-icon="inline-start" />
          Légende
        </Button>

        <Button
          variant={selectionMode ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={selectionMode}
          onClick={onToggleSelection}
        >
          <SquareCheckBig data-icon="inline-start" />
          Sélection
        </Button>

        {mixRows.length > 0 ? (
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
              <ChartPie data-icon="inline-start" />
              Mix du mois
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <PillarMixPanel rows={mixRows} />
            </PopoverContent>
          </Popover>
        ) : null}

        <Button variant="ghost" size="sm" onClick={onOpenAutomations}>
          <Workflow data-icon="inline-start" />
          Automatisations
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenExport}>
          <Download data-icon="inline-start" />
          Exporter
        </Button>
      </div>
    </div>
  )
}
