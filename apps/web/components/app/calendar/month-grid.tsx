"use client"

import { CalendarDays, Plus } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { type MessageKey, useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { createContentHref } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"
import { type DayKey, monthOf } from "./calendar-utils"
import { DayCell } from "./day-cell"

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

// Grille mensuelle lundi→dimanche. L'empty state propose désormais une action
// concrète (création préremplie sur aujourd'hui).

export function MonthGrid({
  days,
  currentMonth,
  itemsByDay,
  ctx,
}: {
  days: DayKey[]
  currentMonth: number
  itemsByDay: ReadonlyMap<DayKey, ContentItem[]>
  ctx: DayContext
}) {
  const t = useT()
  const monthHasContent = days.some(
    (k) => monthOf(k) === currentMonth && (itemsByDay.get(k)?.length ?? 0) > 0
  )

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border-r border-b">
        <div className="grid grid-cols-7 border-t border-l bg-muted/40">
          {WEEKDAY_KEYS.map((labelKey) => (
            <div
              key={labelKey}
              className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {t(labelKey)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((key) => (
            <DayCell
              key={key}
              dayKey={key}
              items={itemsByDay.get(key) ?? []}
              ctx={ctx}
              isToday={key === ctx.todayKey}
              isOutside={monthOf(key) !== currentMonth}
            />
          ))}
        </div>
      </div>

      {!monthHasContent ? (
        <EmptyState
          icon={CalendarDays}
          title={t("calendar.monthGrid.emptyTitle")}
          description={t("calendar.monthGrid.emptyDescription")}
          action={
            <Button
              size="sm"
              render={<Link href={createContentHref(ctx.clientId, ctx.todayKey, ctx.tz)} />}
            >
              <Plus data-icon="inline-start" />
              {t("calendar.monthGrid.createContent")}
            </Button>
          }
        />
      ) : null}
    </div>
  )
}
