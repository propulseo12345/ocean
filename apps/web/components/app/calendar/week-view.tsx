"use client"

import { useDroppable } from "@dnd-kit/core"
import { Flag, Plus, StickyNote } from "lucide-react"
import Link from "next/link"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/format"
import { type MessageKey, useLocale, useT } from "@/lib/i18n"
import { getMarronniersOn } from "@/lib/marronniers"
import type { ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { droppableDayId, useDragActive } from "./calendar-dnd"
import { manualKindOf } from "./calendar-insights"
import { createContentHref } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"
import { type DayKey, dayNumber, weekdayDayMonth } from "./calendar-utils"
import { EntryMarkers, entryToneClass, PlatformDots, pillarEdgeStyle } from "./entry-markers"
import { EntryShell } from "./entry-shell"

// Vue semaine : 7 cartes jour, droppables, avec statuts en toutes lettres.

// Entêtes de jours (lundi → dimanche) traduits via le namespace calendar.
const WEEKDAY_KEYS: MessageKey[] = [
  "calendar.weekdays.mon",
  "calendar.weekdays.tue",
  "calendar.weekdays.wed",
  "calendar.weekdays.thu",
  "calendar.weekdays.fri",
  "calendar.weekdays.sat",
  "calendar.weekdays.sun",
]

export function WeekView({
  days,
  itemsByDay,
  ctx,
}: {
  days: DayKey[]
  itemsByDay: ReadonlyMap<DayKey, ContentItem[]>
  ctx: DayContext
}) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((key, i) => (
        <WeekDayColumn
          key={key}
          dayKey={key}
          weekdayLabel={t(WEEKDAY_KEYS[i])}
          items={itemsByDay.get(key) ?? []}
          ctx={ctx}
        />
      ))}
    </div>
  )
}

function WeekDayColumn({
  dayKey,
  weekdayLabel,
  items,
  ctx,
}: {
  dayKey: DayKey
  weekdayLabel: string
  items: ContentItem[]
  ctx: DayContext
}) {
  const t = useT()
  const { locale } = useLocale()
  const isToday = dayKey === ctx.todayKey
  const isPast = dayKey < ctx.todayKey
  const dragActive = useDragActive()
  const { setNodeRef, isOver } = useDroppable({ id: droppableDayId(dayKey), disabled: isPast })
  const marronniers = ctx.showMarronniers ? getMarronniersOn(dayKey) : []
  const events = ctx.eventsByDay.get(dayKey) ?? []

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-44 flex-col rounded-xl border bg-card transition-colors",
        isPast && !isToday && "bg-muted/20",
        isToday && "ring-1 ring-inset ring-primary/40",
        dragActive && isPast && "opacity-50",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between rounded-t-xl border-b px-2.5 py-2",
          isToday && "bg-primary/[0.05]"
        )}
      >
        <button
          type="button"
          onClick={() => ctx.onOpenDay(dayKey)}
          aria-label={t("calendar.week.viewDay", { day: weekdayDayMonth(dayKey, ctx.tz, locale) })}
          className="flex items-baseline gap-1.5 rounded-md transition-colors hover:bg-muted"
        >
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {weekdayLabel}
          </span>
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
              isToday
                ? "bg-primary text-primary-foreground"
                : isPast
                  ? "text-muted-foreground"
                  : "text-foreground"
            )}
          >
            {dayNumber(dayKey)}
          </span>
        </button>
        {!isPast ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("calendar.week.newContent", {
              day: weekdayDayMonth(dayKey, ctx.tz, locale),
            })}
            className="text-muted-foreground"
            render={<Link href={createContentHref(ctx.clientId, dayKey, ctx.tz)} />}
          >
            <Plus />
          </Button>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col gap-1.5 p-2", isPast && !isToday && "opacity-80")}>
        {marronniers.map((m) => {
          const label = m.label
          return (
            <span
              key={`${m.date}_${label}`}
              title={label}
              className="truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
            >
              {label}
            </span>
          )
        })}
        {events.map((ev) => (
          <span
            key={ev.id}
            title={ev.title}
            className="flex items-center gap-1 truncate rounded-md border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {ev.kind === "note" ? (
              <StickyNote className="size-2.5 shrink-0" aria-label={t("calendar.week.note")} />
            ) : (
              <Flag className="size-2.5 shrink-0" aria-label={t("calendar.week.event")} />
            )}
            <span className="truncate">{ev.title}</span>
          </span>
        ))}

        {items.length === 0 && events.length === 0 && marronniers.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-2 py-4 text-center text-xs text-muted-foreground/60">
            {t("calendar.week.noContent")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <WeekCard item={item} ctx={ctx} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function WeekCard({ item, ctx }: { item: ContentItem; ctx: DayContext }) {
  const { locale } = useLocale()
  const hasPillar = Boolean(item.pillarId && ctx.pillarById.get(item.pillarId))
  return (
    <EntryShell
      item={item}
      ctx={ctx}
      style={pillarEdgeStyle(item, ctx)}
      className={cn(
        "rounded-lg border p-2 transition-colors",
        hasPillar && "border-l-2",
        // Canal manuel : bordure pointillée (différencie du flux API).
        manualKindOf(item) !== null && "border-dashed",
        entryToneClass(item)
      )}
    >
      <span className="block space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {item.scheduledAt ? formatTime(item.scheduledAt, ctx.tz) : ""}
          </span>
          <EntryMarkers item={item} ctx={ctx} className="ml-auto" />
          <FormatIcon format={item.format} className="size-3.5" />
        </span>
        {item.media[0] ? (
          <MediaThumb
            media={item.media[0]}
            alt=""
            count={item.media.length}
            className="aspect-video w-full rounded-md"
            sizes="160px"
          />
        ) : null}
        <span
          className={cn(
            "block truncate text-xs font-medium",
            item.status === "canceled" && "line-through"
          )}
        >
          {item.title}
        </span>
        <span className="flex items-center justify-between gap-1">
          <ContentStatusBadge status={item.status} className="text-[10px]" />
          <PlatformDots platforms={item.targets.map((t) => t.platform)} max={4} />
        </span>
      </span>
    </EntryShell>
  )
}
