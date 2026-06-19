import { Lock, Pin } from "lucide-react"
import { useT } from "@/lib/i18n"
import { toneDotClass } from "@/lib/mocks/labels"
import { cn } from "@/lib/utils"

function LegendDot({ className }: { className: string }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", className)} />
}

// Légende alignée sur le rendu réel des tuiles (anneaux, pastilles, cadenas).
export function GridLegend() {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-full bg-primary/60 ring-2 ring-primary/30" />
        {t("grid.legend.planned")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className={toneDotClass.warning} />
        {t("grid.legend.inReview")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className={toneDotClass.danger} />
        {t("grid.legend.changesOrFailed")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className={toneDotClass.success} />
        {t("grid.legend.approvedOrPublished")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="size-3 shrink-0" />
        {t("grid.legend.imported")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Pin className="size-3 shrink-0" />
        {t("grid.legend.pinned")}
      </span>
    </div>
  )
}
