import { BellRing, Flag, Hand, Lock, PartyPopper, StickyNote } from "lucide-react"
import { contentStatusMeta, platformMeta, toneDotClass } from "@/lib/mocks/labels"
import type { ContentStatus, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Légende repliable : statuts, plateformes et marqueurs spéciaux du calendrier.

const LEGEND_STATUSES = Object.keys(contentStatusMeta) as ContentStatus[]
const LEGEND_PLATFORMS = Object.keys(platformMeta) as Platform[]

export function CalendarLegend() {
  return (
    <div className="space-y-2.5 rounded-xl border bg-card/50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold text-muted-foreground uppercase">Statuts</span>
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className={cn("size-2 rounded-full", toneDotClass[contentStatusMeta[s].tone])}
              aria-hidden
            />
            {contentStatusMeta[s].label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold text-muted-foreground uppercase">Plateformes</span>
        {LEGEND_PLATFORMS.map((p) => (
          <span key={p} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: platformMeta[p].colorVar }}
              aria-hidden
            />
            {platformMeta[p].label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
        <span className="font-semibold uppercase">Marqueurs</span>
        <span className="flex items-center gap-1.5">
          <Lock className="size-3" aria-hidden /> Date verrouillée
        </span>
        <span className="flex items-center gap-1.5">
          <Hand className="size-3" aria-hidden /> Publication manuelle
        </span>
        <span className="flex items-center gap-1.5">
          <BellRing className="size-3" aria-hidden /> Brouillon TikTok
        </span>
        <span className="flex items-center gap-1.5">
          <StickyNote className="size-3" aria-hidden /> Note interne
        </span>
        <span className="flex items-center gap-1.5">
          <Flag className="size-3" aria-hidden /> Événement client
        </span>
        <span className="flex items-center gap-1.5">
          <PartyPopper className="size-3" aria-hidden /> Marronnier
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 border-t-2 border-dashed border-warning/60"
            aria-hidden
          />
          Trou de cadence
        </span>
      </div>
    </div>
  )
}
