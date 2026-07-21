import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/lib/i18n/config"
import type { ContentItem } from "@/lib/mocks/types"

// Vue calendrier. Tout est raisonne en "cle jour" (YYYY-MM-DD) dans le fuseau
// du client : on ne se fie jamais au fuseau runtime du navigateur/serveur pour
// construire la grille.

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

/** Cle jour d'un instant ISO, exprimee dans le fuseau du client. */
export function dayKeyOf(iso: string, tz: string): DayKey {
  return keyFormatter(tz).format(new Date(iso))
}

/** Date calendaire stable : midi UTC evite tout glissement de jour. */
function dateFromKey(key: DayKey): Date {
  return new Date(`${key}T12:00:00.000Z`)
}

function keyFromParts(year: number, month: number, day: number): DayKey {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function keyFromUtcDate(d: Date): DayKey {
  return keyFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function addDaysKey(key: DayKey, days: number): DayKey {
  const d = dateFromKey(key)
  d.setUTCDate(d.getUTCDate() + days)
  return keyFromUtcDate(d)
}

function dayOfWeek(key: DayKey): number {
  return dateFromKey(key).getUTCDay()
}

function startOfWeekKey(key: DayKey): DayKey {
  const dow = dayOfWeek(key)
  return addDaysKey(key, dow === 0 ? -6 : 1 - dow)
}

function endOfWeekKey(key: DayKey): DayKey {
  return addDaysKey(startOfWeekKey(key), 6)
}

function daysBetweenInclusive(start: DayKey, end: DayKey): DayKey[] {
  const days: DayKey[] = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    cursor = addDaysKey(cursor, 1)
  }
  return days
}

function normalizeMonth(year: number, month: number): CalendarCursor {
  const d = new Date(Date.UTC(year, month, 1, 12))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}

function firstDayKey(cursor: CalendarCursor): DayKey {
  return keyFromParts(cursor.year, cursor.month, 1)
}

function lastDayKey(cursor: CalendarCursor): DayKey {
  const last = new Date(Date.UTC(cursor.year, cursor.month + 1, 0, 12)).getUTCDate()
  return keyFromParts(cursor.year, cursor.month, last)
}

/** Numero de jour du mois (1-31) a partir de la cle. */
export function dayNumber(key: DayKey): number {
  return Number(key.slice(8, 10))
}

/** Le mois (0-11) porte par la cle. */
export function monthOf(key: DayKey): number {
  return Number(key.slice(5, 7)) - 1
}

export interface CalendarCursor {
  /** Annee du mois affiche. */
  year: number
  /** Mois affiche (0-11). */
  month: number
}

/** Curseur initial (mois de now dans le fuseau du client). */
export function cursorFromKey(key: DayKey): CalendarCursor {
  return { year: Number(key.slice(0, 4)), month: monthOf(key) }
}

export function shiftMonth(cursor: CalendarCursor, delta: number): CalendarCursor {
  return normalizeMonth(cursor.year, cursor.month + delta)
}

/** Grille mensuelle complete (lundi->dimanche), bordee des jours debordants. */
export function monthGridKeys(cursor: CalendarCursor): DayKey[] {
  return daysBetweenInclusive(startOfWeekKey(firstDayKey(cursor)), endOfWeekKey(lastDayKey(cursor)))
}

/** Les 7 jours (lundi->dimanche) de la semaine contenant `anchorKey`. */
export function weekGridKeys(anchorKey: DayKey): DayKey[] {
  const start = startOfWeekKey(anchorKey)
  return daysBetweenInclusive(start, addDaysKey(start, 6))
}

export function shiftWeek(anchorKey: DayKey, deltaDays: number): DayKey {
  return addDaysKey(anchorKey, deltaDays)
}

/** Libelle "lundi 9 juin" / "Monday, June 9" d'une cle jour. */
export function weekdayDayMonth(key: DayKey, tz: string, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(key))
}

/** Libelle "juin 2026" / "June 2026" du mois affiche. */
export function monthYearLabel(cursor: CalendarCursor, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1, 12)))
}

/** Indexe les contenus dates par cle jour (fuseau du client). */
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
