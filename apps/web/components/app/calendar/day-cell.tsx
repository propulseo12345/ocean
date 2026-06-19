"use client"

import { useDroppable } from "@dnd-kit/core"
import { Flag, Plus, StickyNote } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type MessageKey, pick, useLocale, useT } from "@/lib/i18n"
import { getMarronniersOn, type MarronnierKind } from "@/lib/marronniers"
import { contentStatusMeta, toneDotClass } from "@/lib/mocks/labels"
import type { ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { droppableDayId, useDragActive } from "./calendar-dnd"
import { createContentHref } from "./calendar-schedule"
import {
  type DayContext,
  DENSITY_INFO_AT,
  DENSITY_WARN_AT,
  MAX_VISIBLE_PER_CELL,
} from "./calendar-types"
import { type DayKey, dayNumber, weekdayDayMonth } from "./calendar-utils"
import { DayEntry } from "./day-entry"

// Clé i18n du libellé d'un type de marronnier.
const MARRONNIER_KIND_KEY: Record<MarronnierKind, MessageKey> = {
  ferie: "marronnier.kind.ferie",
  fete: "marronnier.kind.fete",
  soldes: "marronnier.kind.soldes",
  marketing: "marronnier.kind.marketing",
}

// Couleur de pastille par type de marronnier (tokens chart uniquement).
const MARRONNIER_DOT: Record<MarronnierKind, string> = {
  ferie: "bg-chart-4",
  fete: "bg-chart-3",
  soldes: "bg-chart-5",
  marketing: "bg-chart-2",
}

const MAX_MOBILE_DOTS = 4

export function DayCell({
  dayKey,
  items,
  ctx,
  isToday,
  isOutside,
}: {
  dayKey: DayKey
  items: ContentItem[]
  ctx: DayContext
  isToday: boolean
  isOutside: boolean
}) {
  const t = useT()
  const { locale } = useLocale()
  const isPast = dayKey < ctx.todayKey
  const dragActive = useDragActive()
  const { setNodeRef, isOver } = useDroppable({ id: droppableDayId(dayKey), disabled: isPast })

  const visible = items.slice(0, MAX_VISIBLE_PER_CELL)
  const overflow = items.length - visible.length
  const marronniers = ctx.showMarronniers ? getMarronniersOn(dayKey) : []
  const events = ctx.eventsByDay.get(dayKey) ?? []
  const density = ctx.densityByDay.get(dayKey) ?? 0
  const dayLabel = weekdayDayMonth(dayKey, ctx.tz, locale)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell relative flex min-h-20 flex-col gap-1 border-t border-l p-1.5 transition-colors sm:min-h-32",
        isOutside ? "bg-muted/30 text-muted-foreground/70" : "bg-card",
        isPast && !isToday && "bg-muted/20",
        isToday && "bg-primary/[0.04] ring-1 ring-inset ring-primary/40",
        dragActive && isPast && "opacity-50",
        dragActive && !isPast && "outline-1 -outline-offset-2 outline-dashed outline-primary/30",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary"
      )}
    >
      {ctx.gapDays.has(dayKey) ? (
        <span
          aria-hidden
          title={t("calendar.dayCell.gapTitle")}
          className="pointer-events-none absolute inset-x-1.5 bottom-1 border-t-2 border-dashed border-warning/60"
        />
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => ctx.onOpenDay(dayKey)}
          aria-label={t("calendar.dayCell.viewDay", { day: dayLabel })}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors hover:bg-muted",
            isToday
              ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              : isPast || isOutside
                ? "text-muted-foreground/60"
                : "text-muted-foreground"
          )}
        >
          {dayNumber(dayKey)}
        </button>

        <div className="flex items-center gap-1">
          {density >= DENSITY_INFO_AT ? (
            <span
              title={
                density >= DENSITY_WARN_AT
                  ? t("calendar.dayCell.densityHigh", { count: density })
                  : t("calendar.dayCell.densityNormal", { count: density })
              }
              className={cn(
                "hidden rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums sm:inline",
                density >= DENSITY_WARN_AT
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t("calendar.dayCell.posts", { count: density })}
            </span>
          ) : null}
          {!isPast ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("calendar.dayCell.addTo", { day: dayLabel })}
                    className="hidden opacity-0 transition-opacity group-hover/cell:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 sm:inline-flex"
                  />
                }
              >
                <Plus />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem
                  render={<Link href={createContentHref(ctx.clientId, dayKey, ctx.tz)} />}
                >
                  {t("calendar.dayCell.createContent")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => ctx.onOpenDay(dayKey)}>
                  {t("calendar.dayCell.addNote")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Mobile : mois condensé — points de statut, tap = panneau Jour. */}
      <button
        type="button"
        onClick={() => ctx.onOpenDay(dayKey)}
        aria-label={t("calendar.dayCell.itemsOnDay", { count: items.length, day: dayLabel })}
        className="flex flex-1 flex-col items-center justify-start gap-1 pt-0.5 sm:hidden"
      >
        <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
          {items.slice(0, MAX_MOBILE_DOTS).map((it) => (
            <span
              key={it.id}
              className={cn(
                "size-1.5 rounded-full",
                toneDotClass[contentStatusMeta[it.status].tone]
              )}
            />
          ))}
          {items.length > MAX_MOBILE_DOTS ? (
            <span className="text-[9px] text-muted-foreground tabular-nums">
              +{items.length - MAX_MOBILE_DOTS}
            </span>
          ) : null}
        </span>
        {events.length > 0 || marronniers.length > 0 ? (
          <span className="size-1 rounded-full bg-chart-2" aria-hidden />
        ) : null}
      </button>

      {/* Desktop : contenu complet de la case. */}
      <div className="hidden min-w-0 flex-1 flex-col gap-1 sm:flex">
        {marronniers.map((m) => {
          const label = pick(m.label, locale)
          const kind = t(MARRONNIER_KIND_KEY[m.kind])
          return (
            <Link
              key={`${m.date}_${label}`}
              href={createContentHref(ctx.clientId, dayKey, ctx.tz)}
              title={t("calendar.dayCell.marronnierTitle", { label, kind })}
              className="flex items-center gap-1 truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground transition-colors hover:bg-secondary/70"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", MARRONNIER_DOT[m.kind])} />
              <span className="truncate">{label}</span>
              <span className="sr-only">{t("calendar.dayCell.marronnierKindSr", { kind })}</span>
            </Link>
          )
        })}

        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={() => ctx.onOpenDay(dayKey)}
            title={pick(ev.title, locale)}
            className="flex items-center gap-1 truncate rounded-md border border-dashed bg-card px-1.5 py-0.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted"
          >
            {ev.kind === "note" ? (
              <StickyNote className="size-2.5 shrink-0" aria-label={t("calendar.dayCell.note")} />
            ) : (
              <Flag className="size-2.5 shrink-0" aria-label={t("calendar.dayCell.event")} />
            )}
            <span className="truncate">{pick(ev.title, locale)}</span>
          </button>
        ))}

        <ul className="flex min-w-0 flex-col gap-1">
          {visible.map((item) => (
            <li key={item.id} className="min-w-0">
              <DayEntry item={item} ctx={ctx} />
            </li>
          ))}
          {overflow > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => ctx.onOpenDay(dayKey)}
                className="block w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("calendar.dayCell.moreOthers", { count: overflow })}
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
