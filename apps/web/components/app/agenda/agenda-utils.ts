import type { AgendaItem } from "@/lib/mocks/types"

// Bornes horaires de la grille semaine (fuseau du freelance).
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 21
export const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i
)

// Libellés courts des jours (lun → dim).
export const WEEKDAY_LABELS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]

// Décompose un instant ISO dans un fuseau donné, sans dépendre de l'heure locale.
interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** Clé jour stable "YYYY-MM-DD" dans le fuseau. */
  dayKey: string
}

const partsCache = new Map<string, ZonedParts>()

export function zonedParts(iso: string, tz: string): ZonedParts {
  const cacheKey = `${iso}|${tz}`
  const cached = partsCache.get(cacheKey)
  if (cached) return cached
  const f = new Intl.DateTimeFormat("fr-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const map: Record<string, string> = {}
  for (const p of f.formatToParts(new Date(iso))) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  const result: ZonedParts = {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    dayKey: `${map.year}-${map.month}-${map.day}`,
  }
  partsCache.set(cacheKey, result)
  return result
}

// Position verticale (en fraction 0→1) d'un instant dans la plage horaire affichée.
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60

export function minuteOffset(iso: string, tz: string): number {
  const { hour, minute } = zonedParts(iso, tz)
  const clampedHour = Math.min(Math.max(hour, DAY_START_HOUR), DAY_END_HOUR)
  const mins = (clampedHour - DAY_START_HOUR) * 60 + (hour < DAY_START_HOUR ? 0 : minute)
  return Math.min(Math.max(mins, 0), TOTAL_MINUTES) / TOTAL_MINUTES
}

export function durationFraction(startIso: string, endIso: string, tz: string): number {
  const a = zonedParts(startIso, tz)
  const b = zonedParts(endIso, tz)
  const startMin = a.hour * 60 + a.minute
  const endMin = b.hour * 60 + b.minute
  const raw = (endMin - startMin) / TOTAL_MINUTES
  return Math.min(Math.max(raw, 0.04), 1)
}

// Lundi de la semaine contenant `ref`, à minuit UTC (base de navigation).
export function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref)
  d.setUTCHours(0, 0, 0, 0)
  const dow = d.getUTCDay() // 0 = dimanche
  const diff = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

export function addDays(ref: Date, n: number): Date {
  const d = new Date(ref)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function dayKeyOf(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function agendaStart(item: AgendaItem): string {
  return item.kind === "event" ? item.event.startsAt : item.startsAt
}

// Un item est visible si ses filtres calendrier/compte sont actifs.
export function isItemEnabled(item: AgendaItem, disabledCalendars: ReadonlySet<string>): boolean {
  if (item.kind === "publication") return true
  return !disabledCalendars.has(item.event.calendarName)
}
