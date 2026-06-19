"use client"

import { CalendarDays, Plus } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import type { ContentItem } from "@/lib/mocks/types"
import { createContentHref } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"
import { type DayKey, monthOf, WEEKDAY_LABELS } from "./calendar-utils"
import { DayCell } from "./day-cell"

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
  const monthHasContent = days.some(
    (k) => monthOf(k) === currentMonth && (itemsByDay.get(k)?.length ?? 0) > 0
  )

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border-r border-b">
        <div className="grid grid-cols-7 border-t border-l bg-muted/40">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {label}
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
          title="Aucun contenu programmé ce mois-ci"
          description="Planifie un contenu depuis une case de date, l'étagère « À planifier » ou le studio pour tenir la cadence."
          action={
            <Button
              size="sm"
              render={<Link href={createContentHref(ctx.clientId, ctx.todayKey, ctx.tz)} />}
            >
              <Plus data-icon="inline-start" />
              Créer un contenu
            </Button>
          }
        />
      ) : null}
    </div>
  )
}
