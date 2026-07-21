"use client"

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import { AgendaDayList } from "@/components/app/agenda/agenda-day-list"
import { AgendaSidebar, type CalendarFilter } from "@/components/app/agenda/agenda-sidebar"
import {
  addDays,
  agendaStart,
  calendarKey,
  isItemEnabled,
  startOfWeekMonday,
  weekDays,
  zonedParts,
} from "@/components/app/agenda/agenda-utils"
import { WeekGrid } from "@/components/app/agenda/week-grid"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { now as clockNow } from "@/lib/clock"
import type { AgendaItem, CalendarAccount, CalendarEvent } from "@/lib/domain"
import { useFormat, useT } from "@/lib/i18n"

function buildCalendars(events: CalendarEvent[]): CalendarFilter[] {
  const map = new Map<string, CalendarFilter>()
  for (const e of events) {
    const key = calendarKey(e.calendarName)
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: e.calendarName,
        colorVar: e.colorVar,
        accountId: e.accountId,
      })
    }
  }
  return [...map.values()]
}

export function UnifiedAgenda({
  agenda,
  accounts,
  events,
  tz,
}: {
  agenda: AgendaItem[]
  accounts: CalendarAccount[]
  events: CalendarEvent[]
  tz: string
}) {
  const t = useT()
  const f = useFormat()
  const now = useMemo(() => clockNow(), [])
  const baseMonday = useMemo(() => startOfWeekMonday(now), [now])
  const calendars = useMemo(() => buildCalendars(events), [events])

  // Calendriers désactivés par défaut (event.enabled === false dans les mocks).
  const [disabled, setDisabled] = useState<Set<string>>(() => {
    const off = new Set<string>()
    for (const e of events) if (!e.enabled) off.add(calendarKey(e.calendarName))
    return off
  })
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(() => addDays(baseMonday, weekOffset * 7), [baseMonday, weekOffset])
  const days = useMemo(() => weekDays(weekStart), [weekStart])

  const visible = useMemo(() => {
    const startKey = zonedParts(weekStart.toISOString(), tz).dayKey
    const endKey = zonedParts(addDays(weekStart, 6).toISOString(), tz).dayKey
    return agenda.filter((it) => {
      if (!isItemEnabled(it, disabled)) return false
      const key = zonedParts(agendaStart(it), tz).dayKey
      return key >= startKey && key <= endKey
    })
  }, [agenda, disabled, weekStart, tz])

  const toggle = (key: string) =>
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const rangeLabel = `${f.dayMonth(weekStart.toISOString(), tz)} – ${f.dayMonth(
    addDays(weekStart, 6).toISOString(),
    tz
  )}`

  const sidebar = (
    <AgendaSidebar
      accounts={accounts}
      calendars={calendars}
      disabled={disabled}
      onToggle={toggle}
    />
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3 lg:order-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("agenda.prevWeek")}
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("agenda.nextWeek")}
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              {t("agenda.today")}
            </Button>
            <span className="ml-1 text-sm font-medium text-muted-foreground capitalize">
              {rangeLabel}
            </span>
          </div>

          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal />
                  {t("agenda.filters")}
                </Button>
              }
            />
            <SheetContent side="right" className="w-80 max-w-[85vw]">
              <SheetHeader>
                <SheetTitle>{t("agenda.calendarsAndFilters")}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-6">{sidebar}</div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Grille semaine (desktop) */}
        <div className="hidden lg:block">
          <WeekGrid days={days} items={visible} tz={tz} now={now} />
        </div>

        {/* Liste par jour (mobile / tablette) */}
        <div className="lg:hidden">
          <AgendaDayList days={days} items={visible} tz={tz} now={now} />
        </div>
      </div>

      <aside className="hidden lg:order-2 lg:block">{sidebar}</aside>
    </div>
  )
}
