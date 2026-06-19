"use client"

import {
  agendaStart,
  dayKeyOf,
  durationFraction,
  HOURS,
  minuteOffset,
  WEEKDAY_KEYS,
  zonedParts,
} from "@/components/app/agenda/agenda-utils"
import { AgendaBlock } from "@/components/app/agenda/event-block"
import { isSameDay } from "@/lib/format"
import { INTL_LOCALE, type Locale, useFormat, useLocale, useT } from "@/lib/i18n"
import type { AgendaItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

const ROW_HEIGHT = 56 // px par heure

// Libellé d'une heure pleine dans la colonne horaire, localisé.
// FR → « 7h », EN → « 7 AM » (format 12h naturel pour l'anglais).
function formatHourLabel(hour: number, locale: Locale): string {
  if (locale === "fr") return `${hour}h`
  const d = new Date(Date.UTC(2000, 0, 1, hour))
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    hour: "numeric",
    hour12: true,
  }).format(d)
}

function endIso(item: AgendaItem): string {
  return item.kind === "event" ? item.event.endsAt : item.startsAt
}

function isAllDay(item: AgendaItem): boolean {
  return item.kind === "event" && item.event.allDay
}

export function WeekGrid({
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
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const dayKeys = days.map((d) => dayKeyOf(d, tz))
  const timed = items.filter((it) => !isAllDay(it))
  const allDay = items.filter(isAllDay)
  // Le span est le nombre d'INTERVALLES horaires (14 = 7h→21h), pas le nombre
  // de libellés (15) — sinon les blocs dérivent verticalement au fil de la journée.
  const hourRows = HOURS.slice(0, -1)
  const gridHeight = hourRows.length * ROW_HEIGHT

  const byDay = (key: string, list: AgendaItem[]) =>
    list.filter((it) => zonedParts(agendaStart(it), tz).dayKey === key)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* En-têtes de jours */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b bg-muted/30">
        <div className="border-r" />
        {days.map((d, i) => {
          const today = isSameDay(d.toISOString(), now, tz)
          return (
            <div
              key={dayKeys[i]}
              className={cn(
                "border-r px-2 py-2 text-center last:border-r-0",
                today && "bg-primary/5"
              )}
            >
              <span className="block text-xs text-muted-foreground capitalize">
                {t(WEEKDAY_KEYS[i])}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-flex min-w-6 items-center justify-center rounded-md px-1 text-sm font-medium tabular-nums",
                  today && "bg-primary text-primary-foreground"
                )}
              >
                {f.dayMonth(d.toISOString(), tz)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bande journée entière */}
      {allDay.length > 0 ? (
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b bg-muted/10">
          <div className="flex items-center justify-end border-r px-1.5 py-1 text-[10px] text-muted-foreground">
            {t("agenda.allDayShort")}
          </div>
          {dayKeys.map((key) => (
            <div key={key} className="space-y-1 border-r p-1 last:border-r-0">
              {byDay(key, allDay).map((it) => (
                <div key={it.id} className="h-9">
                  <AgendaBlock item={it} tz={tz} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {/* Grille horaire */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
        {/* Colonne des heures (libellé au sommet de chaque intervalle) */}
        <div className="border-r">
          {hourRows.map((h) => (
            <div
              key={h}
              style={{ height: ROW_HEIGHT }}
              className="pr-1.5 pt-0.5 text-right text-[10px] text-muted-foreground tabular-nums"
            >
              {formatHourLabel(h, locale)}
            </div>
          ))}
        </div>

        {/* Une colonne par jour */}
        {dayKeys.map((key, i) => {
          const today = isSameDay(days[i].toISOString(), now, tz)
          return (
            <div
              key={key}
              className={cn("relative border-r last:border-r-0", today && "bg-primary/5")}
              style={{ height: gridHeight }}
            >
              {hourRows.map((h) => (
                <div
                  key={h}
                  style={{ height: ROW_HEIGHT }}
                  className="border-b border-dashed last:border-b-0"
                />
              ))}
              {byDay(key, timed).map((it) => {
                const top = minuteOffset(agendaStart(it), tz) * gridHeight
                const height = Math.max(
                  durationFraction(agendaStart(it), endIso(it), tz) * gridHeight,
                  24
                )
                return (
                  <div key={it.id} className="absolute inset-x-0.5" style={{ top, height }}>
                    <AgendaBlock item={it} tz={tz} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
