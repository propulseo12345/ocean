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
import type { QuotaUsage } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import type { GridRatio, PillarOption } from "./grid-types"
import type { GridViewState } from "./use-grid-view"

// Barre d'outils de la grille : ratio, rendu final, sélection, quota, synchro,
// validation de la grille entière et actions secondaires.

const RATIOS: GridRatio[] = ["1:1", "3:4"]

function RatioSwitch({ ratio, onRatio }: { ratio: GridRatio; onRatio: (r: GridRatio) => void }) {
  return (
    <div
      role="group"
      aria-label="Ratio des tuiles"
      className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {RATIOS.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={ratio === r}
          title={
            r === "3:4"
              ? "Recadrage réel du profil Instagram (depuis 2025)"
              : "Ancien affichage carré"
          }
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
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
      <RatioSwitch ratio={view.ratio} onRatio={view.setRatio} />

      <Button
        variant={view.finalRender ? "secondary" : "outline"}
        size="sm"
        aria-pressed={view.finalRender}
        title="Masquer pastilles et dates pour voir le feed comme un visiteur"
        onClick={() => view.setFinalRender(!view.finalRender)}
      >
        <LayoutTemplate />
        Rendu final
      </Button>

      <Button
        variant={view.selectionMode ? "secondary" : "outline"}
        size="sm"
        aria-pressed={view.selectionMode}
        title="Cocher plusieurs tuiles planifiées pour agir en lot"
        onClick={() => view.setSelectionMode(!view.selectionMode)}
        disabled={view.finalRender}
      >
        <SquareDashedMousePointer />
        Sélectionner
      </Button>

      <span className="flex-1" />

      {quota ? (
        <div className="w-40" title="Quota API Instagram — l'enforcement réel sera côté worker">
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
          Synchroniser le feed
        </Button>
        <span className="pl-1 text-[10px] text-muted-foreground">
          Dernière synchro {view.lastSync}
        </span>
      </div>

      {view.validationSent ? (
        <span className="inline-flex h-7 items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 text-[0.8rem] font-medium text-success">
          <BadgeCheck className="size-3.5" />
          Grille envoyée en validation (aperçu)
        </span>
      ) : (
        <Button size="sm" onClick={onOpenValidation} disabled={plannedCount === 0}>
          <Send />
          Demander la validation
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Plus d'actions" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LayoutTemplate className="size-4" />
              Réserver une case par pilier
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {pillars.length === 0 ? (
                <DropdownMenuItem disabled>Aucun pilier défini</DropdownMenuItem>
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
            Mode présentation
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={view.demoMode}
            onCheckedChange={(checked) => view.setDemoMode(checked === true)}
          >
            <UserRound className="size-4" />
            Mode démo prospect
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onResetAll}>
            <RotateCcw className="size-4" />
            Réinitialiser la grille
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
