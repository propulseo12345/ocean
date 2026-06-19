"use client"

import { CalendarOff } from "lucide-react"
import {
  agendaStart,
  dayKeyOf,
  WEEKDAY_LABELS,
  zonedParts,
} from "@/components/app/agenda/agenda-utils"
import { AgendaBlock } from "@/components/app/agenda/event-block"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDayMonth, isSameDay } from "@/lib/format"
import type { AgendaItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Repli mobile : la grille semaine est trop dense → liste par jour.
export function AgendaDayList({
  days,
  items,
  tz,
  now,
}: {
  days: Date[]
  items: AgendaItem[]
  tz: string
  now: Date
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Semaine libre"
        description="Aucun rendez-vous ni publication sur cette semaine."
      />
    )
  }
  return (
    <div className="space-y-4">
      {days.map((d, i) => {
        const key = dayKeyOf(d, tz)
        const dayItems = items
          .filter((it) => zonedParts(agendaStart(it), tz).dayKey === key)
          .sort((a, b) => agendaStart(a).localeCompare(agendaStart(b)))
        if (dayItems.length === 0) return null
        const today = isSameDay(d.toISOString(), now, tz)
        return (
          <section key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "font-heading text-sm font-semibold capitalize",
                  today && "text-primary"
                )}
              >
                {WEEKDAY_LABELS[i]} {formatDayMonth(d.toISOString(), tz)}
              </h3>
              {today ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Aujourd'hui
                </span>
              ) : null}
            </div>
            <ul className="space-y-1.5">
              {dayItems.map((it) => (
                <li key={it.id} className="min-h-12">
                  <AgendaBlock item={it} tz={tz} compact />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
