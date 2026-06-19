"use client"

import { ChevronDown, Lightbulb, Recycle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { pick, useLocale, useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import type { DayContext } from "./calendar-types"
import { type DayKey, weekdayDayMonth } from "./calendar-utils"
import { EntryShell } from "./entry-shell"

// Étagère « À planifier » (contenus sans date, glissables vers une case) +
// file evergreen avec auto-remplissage des trous (proposition, jamais d'envoi).

const MAX_PROPOSALS = 3

export function PlanningShelf({
  shelfItems,
  evergreenItems,
  ctx,
}: {
  shelfItems: ContentItem[]
  evergreenItems: ContentItem[]
  ctx: DayContext
}) {
  const t = useT()
  const { locale } = useLocale()
  const [autoFill, setAutoFill] = useState(false)

  const gapKeys = [...ctx.gapDays].sort().filter((k) => k >= ctx.todayKey)
  const proposals: { dayKey: DayKey; item: ContentItem }[] = []
  if (autoFill) {
    const pool = [...shelfItems, ...evergreenItems]
    for (let i = 0; i < Math.min(gapKeys.length, MAX_PROPOSALS) && pool.length > 0; i++) {
      proposals.push({ dayKey: gapKeys[i], item: pool[i % pool.length] })
    }
  }

  return (
    <div className="space-y-3">
      <Collapsible defaultOpen className="rounded-xl border bg-card/50">
        <CollapsibleTrigger className="group/shelf flex w-full items-center gap-2 p-3 text-left">
          <Lightbulb className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold">{t("calendar.shelf.toPlan")}</h2>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {shelfItems.length}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-panel-open/shelf:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          {shelfItems.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {t("calendar.shelf.allPlanned")}
            </p>
          ) : (
            <ul className="space-y-2">
              {shelfItems.map((item) => (
                <li key={item.id}>
                  <ShelfCard item={item} ctx={ctx} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2.5 px-1 text-[11px] leading-snug text-muted-foreground">
            {t("calendar.shelf.dragHint")}
          </p>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="rounded-xl border bg-card/50">
        <CollapsibleTrigger className="group/ever flex w-full items-center gap-2 p-3 text-left">
          <Recycle className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold">
            {t("calendar.shelf.evergreenQueue")}
          </h2>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {evergreenItems.length}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-panel-open/ever:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2.5 px-3 pb-3">
          {evergreenItems.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {t("calendar.shelf.evergreenEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {evergreenItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-lg border bg-card p-2"
                >
                  <ShelfThumb item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {pick(item.title, locale)}
                    </span>
                    <ContentStatusBadge status={item.status} className="mt-0.5 text-[10px]" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-2">
            <span className="text-xs font-medium">{t("calendar.shelf.autoFill")}</span>
            <Switch
              checked={autoFill}
              onCheckedChange={(checked) => {
                setAutoFill(checked)
                toast.info(
                  checked ? t("calendar.shelf.autoFillOn") : t("calendar.shelf.autoFillOff"),
                  {
                    description: checked ? t("calendar.shelf.autoFillOnDesc") : undefined,
                  }
                )
              }}
              aria-label={t("calendar.shelf.autoFillToggle")}
            />
          </div>

          {autoFill ? (
            proposals.length > 0 ? (
              <ul className="space-y-1">
                {proposals.map(({ dayKey, item }) => (
                  <li
                    key={`${dayKey}_${item.id}`}
                    className="rounded-md bg-muted/60 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium capitalize">
                      {weekdayDayMonth(dayKey, ctx.tz)}
                    </span>
                    <span className="text-muted-foreground">
                      {t("calendar.shelf.proposalArrow", { title: pick(item.title, locale) })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">{t("calendar.shelf.noGaps")}</p>
            )
          ) : null}

          <p className="px-1 text-[11px] leading-snug text-muted-foreground">
            {t("calendar.shelf.proposalHint")}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ShelfThumb({ item }: { item: ContentItem }) {
  return item.media[0] ? (
    <MediaThumb media={item.media[0]} alt="" className="size-10 shrink-0 rounded-md" sizes="40px" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <FormatIcon format={item.format} className="size-4 text-muted-foreground" />
    </span>
  )
}

function ShelfCard({ item, ctx }: { item: ContentItem; ctx: DayContext }) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <EntryShell
      item={item}
      ctx={ctx}
      className={cn("rounded-lg border bg-card p-2 transition-colors hover:border-primary/40")}
    >
      <span className="flex items-center gap-2.5">
        <ShelfThumb item={item} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{pick(item.title, locale)}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <ContentStatusBadge status={item.status} className="text-[10px]" />
            <span className="text-xs text-muted-foreground">{t("calendar.shelf.noDate")}</span>
          </span>
        </span>
      </span>
    </EntryShell>
  )
}
