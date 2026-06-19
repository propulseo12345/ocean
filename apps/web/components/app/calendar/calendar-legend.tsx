"use client"

import { BellRing, Flag, Hand, Lock, PartyPopper, StickyNote } from "lucide-react"
import { useLabels, useT } from "@/lib/i18n"
import { contentStatusMeta, platformMeta, toneDotClass } from "@/lib/mocks/labels"
import type { ContentStatus, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Légende repliable : statuts, plateformes et marqueurs spéciaux du calendrier.

const LEGEND_STATUSES = Object.keys(contentStatusMeta) as ContentStatus[]
const LEGEND_PLATFORMS = Object.keys(platformMeta) as Platform[]

export function CalendarLegend() {
  const t = useT()
  const lbl = useLabels()
  return (
    <div className="space-y-2.5 rounded-xl border bg-card/50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold text-muted-foreground uppercase">
          {t("calendar.legend.statuses")}
        </span>
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className={cn("size-2 rounded-full", toneDotClass[contentStatusMeta[s].tone])}
              aria-hidden
            />
            {lbl.contentStatus(s)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-semibold text-muted-foreground uppercase">
          {t("calendar.legend.platforms")}
        </span>
        {LEGEND_PLATFORMS.map((p) => (
          <span key={p} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: platformMeta[p].colorVar }}
              aria-hidden
            />
            {lbl.platform(p)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
        <span className="font-semibold uppercase">{t("calendar.legend.markers")}</span>
        <span className="flex items-center gap-1.5">
          <Lock className="size-3" aria-hidden /> {t("calendar.legend.lockedDate")}
        </span>
        <span className="flex items-center gap-1.5">
          <Hand className="size-3" aria-hidden /> {t("calendar.legend.manualPublish")}
        </span>
        <span className="flex items-center gap-1.5">
          <BellRing className="size-3" aria-hidden /> {t("calendar.legend.tiktokDraft")}
        </span>
        <span className="flex items-center gap-1.5">
          <StickyNote className="size-3" aria-hidden /> {t("calendar.legend.internalNote")}
        </span>
        <span className="flex items-center gap-1.5">
          <Flag className="size-3" aria-hidden /> {t("calendar.legend.clientEvent")}
        </span>
        <span className="flex items-center gap-1.5">
          <PartyPopper className="size-3" aria-hidden /> {t("calendar.legend.marronnier")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 border-t-2 border-dashed border-warning/60"
            aria-hidden
          />
          {t("calendar.legend.cadenceGap")}
        </span>
      </div>
    </div>
  )
}
