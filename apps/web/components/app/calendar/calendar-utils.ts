import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import type { ContentItem } from "@/lib/mocks/types"

// Vue calendrier. Tout est raisonné en "clé jour" (YYYY-MM-DD) dans le fuseau
// du client : on ne se fie JAMAIS aux getters locaux d'un Date pour décider
// du jour d'affichage (sinon décalage selon le fuseau du navigateur).

export type DayKey = string // "YYYY-MM-DD"

const KEY_FMT_CACHE = new Map<string, Intl.DateTimeFormat>()

function keyFormatter(tz: string): Intl.DateTimeFormat {
  let f = KEY_FMT_CACHE.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat("fr-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    KEY_FMT_CACHE.set(tz, f)
  }
  return f
}

/** Clé jour d'un instant ISO, exprimée dans le fuseau du client. */
export function dayKeyOf(iso: string, tz: string): DayKey {
  return keyFormatter(tz).format(new Date(iso))
}

/** Date "calendaire" stable : midi UTC évite tout glissement de jour (DST/offset). */
function dateFromKey(key: DayKey): Date {
  return new Date(`${key}T12:00:00.000Z`)
}

function keyFromDate(d: Date): DayKey {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Numéro de jour du mois (1–31) à partir de la clé. */
export function dayNumber(key: DayKey): number {
  return Number(key.slice(8, 10))
}

/** Le mois (0–11) porté par la clé. */
export function monthOf(key: DayKey): number {
  return Number(key.slice(5, 7)) - 1
}

export interface CalendarCursor {
  /** Année du mois affiché. */
  year: number
  /** Mois affiché (0–11). */
  month: number
}

/** Curseur initial (mois de MOCK_NOW dans le fuseau du client). */
export function cursorFromKey(key: DayKey): CalendarCursor {
  return { year: Number(key.slice(0, 4)), month: monthOf(key) }
}

export function shiftMonth(cursor: CalendarCursor, delta: number): CalendarCursor {
  const next = addMonths(new Date(Date.UTC(cursor.year, cursor.month, 1)), delta)
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() }
}

const WEEK_OPTS = { weekStartsOn: 1 } as const // lundi

/** Grille mensuelle complète (lundi→dimanche), bordée des jours débordants. */
export function monthGridKeys(cursor: CalendarCursor): DayKey[] {
  const firstOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 1, 12))
  const gridStart = startOfWeek(startOfMonth(firstOfMonth), WEEK_OPTS)
  const gridEnd = endOfWeek(endOfMonth(firstOfMonth), WEEK_OPTS)
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map(keyFromDate)
}

/** Les 7 jours (lundi→dimanche) de la semaine contenant `anchorKey`. */
export function weekGridKeys(anchorKey: DayKey): DayKey[] {
  const anchor = dateFromKey(anchorKey)
  const start = startOfWeek(anchor, WEEK_OPTS)
  return eachDayOfInterval({ start, end: endOfWeek(anchor, WEEK_OPTS) }).map(keyFromDate)
}

export function shiftWeek(anchorKey: DayKey, deltaDays: number): DayKey {
  return keyFromDate(addDays(dateFromKey(anchorKey), deltaDays))
}

/** Libellé "lundi 9 juin" d'une clé jour. */
export function weekdayDayMonth(key: DayKey, tz: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(key))
}

/** Libellé "juin 2026" du mois affiché. */
export function monthYearLabel(cursor: CalendarCursor): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1, 12)))
}

/** Indexe les contenus datés par clé jour (fuseau du client). */
export function groupByDay(items: ContentItem[], tz: string): Map<DayKey, ContentItem[]> {
  const map = new Map<DayKey, ContentItem[]>()
  for (const item of items) {
    if (!item.scheduledAt) continue
    const key = dayKeyOf(item.scheduledAt, tz)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string))
  }
  return map
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
