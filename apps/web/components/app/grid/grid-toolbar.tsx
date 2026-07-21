"use client"

import {
  BadgeCheck,
  LayoutTemplate,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  SquareDashedMousePointer,
  UserRound,
} from "lucide-react"
import { QuotaGauge } from "@/components/shared/quota-gauge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QuotaUsage } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridRatio, PillarOption } from "./grid-types"
import type { GridViewState } from "./use-grid-view"

// Barre d'outils de la grille : ratio, rendu final, sélection, quota, synchro,
// validation de la grille entière et actions secondaires.

const RATIOS: GridRatio[] = ["1:1", "3:4"]

function RatioSwitch({ ratio, onRatio }: { ratio: GridRatio; onRatio: (r: GridRatio) => void }) {
  const t = useT()
  return (
    <div
      role="group"
      aria-label={t("grid.toolbar.ratioGroup")}
      className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {RATIOS.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={ratio === r}
          title={r === "3:4" ? t("grid.toolbar.ratioCrop34") : t("grid.toolbar.ratioSquare")}
          onClick={() => onRatio(r)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
            ratio === r
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function GridToolbar({
  view,
  quota,
  pillars,
  importedCount,
  plannedCount,
  onOpenValidation,
  onAddPlaceholder,
  onResetAll,
}: {
  view: GridViewState
  quota: QuotaUsage | null
  pillars: PillarOption[]
  importedCount: number
  plannedCount: number
  onOpenValidation: () => void
  onAddPlaceholder: (pillar: PillarOption) => void
  onResetAll: () => void
}) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
      <RatioSwitch ratio={view.ratio} onRatio={view.setRatio} />

      <Button
        variant={view.finalRender ? "secondary" : "outline"}
        size="sm"
        aria-pressed={view.finalRender}
        title={t("grid.toolbar.finalRenderHint")}
        onClick={() => view.setFinalRender(!view.finalRender)}
      >
        <LayoutTemplate />
        {t("grid.toolbar.finalRender")}
      </Button>

      <Button
        variant={view.selectionMode ? "secondary" : "outline"}
        size="sm"
        aria-pressed={view.selectionMode}
        title={t("grid.toolbar.selectHint")}
        onClick={() => view.setSelectionMode(!view.selectionMode)}
        disabled={view.finalRender}
      >
        <SquareDashedMousePointer />
        {t("grid.toolbar.select")}
      </Button>

      <span className="flex-1" />

      {quota ? (
        <div className="w-40" title={t("grid.toolbar.quotaHint")}>
          <QuotaGauge usage={quota} />
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-0.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => view.runSync(importedCount)}
          disabled={view.syncing}
        >
          <RefreshCw className={cn(view.syncing && "animate-spin")} />
          {t("grid.toolbar.syncFeed")}
        </Button>
        <span className="pl-1 text-[10px] text-muted-foreground">
          {t("grid.toolbar.lastSync", { when: view.lastSync })}
        </span>
      </div>

      {view.validationSent ? (
        <span className="inline-flex h-7 items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 text-[0.8rem] font-medium text-success">
          <BadgeCheck className="size-3.5" />
          {t("grid.toolbar.validationSent")}
        </span>
      ) : (
        <Button size="sm" onClick={onOpenValidation} disabled={plannedCount === 0}>
          <Send />
          {t("grid.toolbar.requestValidation")}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label={t("grid.toolbar.moreActions")} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LayoutTemplate className="size-4" />
              {t("grid.toolbar.reserveByPillar")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {pillars.length === 0 ? (
                <DropdownMenuItem disabled>{t("grid.toolbar.noPillar")}</DropdownMenuItem>
              ) : (
                pillars.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => onAddPlaceholder(p)}>
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: p.colorVar }}
                    />
                    {p.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => view.setPresentationOpen(true)}>
            <Smartphone className="size-4" />
            {t("grid.toolbar.presentationMode")}
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={view.demoMode}
            onCheckedChange={(checked) => view.setDemoMode(checked === true)}
          >
            <UserRound className="size-4" />
            {t("grid.toolbar.demoMode")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onResetAll}>
            <RotateCcw className="size-4" />
            {t("grid.toolbar.resetGrid")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
