import { now } from "@/lib/clock"

// Attribution de dates mockée pour la grille (PRD §5.C) : interpolation entre
// voisins, heure pleine, fenêtre 9 h – 21 h dans le fuseau du client,
// jamais avant maintenant + 15 min.

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const MIN_LEAD_MS = 15 * 60_000
const WINDOW_START_HOUR = 9
const WINDOW_END_HOUR = 21

function localHour(date: Date, tz: string): number {
  const text = new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date)
  return Number.parseInt(text, 10)
}

/** Arrondit à l'heure pleine puis ramène dans la fenêtre 9 h – 21 h (fuseau client). */
export function clampToWindow(iso: string, tz: string): string {
  const date = new Date(iso)
  date.setUTCMinutes(0, 0, 0)
  const hour = localHour(date, tz)
  if (hour < WINDOW_START_HOUR) {
    date.setTime(date.getTime() + (WINDOW_START_HOUR - hour) * HOUR_MS)
  } else if (hour > WINDOW_END_HOUR) {
    date.setTime(date.getTime() - (hour - WINDOW_END_HOUR) * HOUR_MS)
  }
  return date.toISOString()
}

function ensureFuture(iso: string): string {
  let time = new Date(iso).getTime()
  const min = now().getTime() + MIN_LEAD_MS
  while (time < min) time += DAY_MS
  return new Date(time).toISOString()
}

/**
 * Date interpolée pour une insertion dans la grille.
 * `beforeIso` = voisin du dessus (plus futur), `afterIso` = voisin du dessous.
 * Drop en tête (pas de voisin au-dessus) : dernier créneau + 24 h.
 */
export function interpolateDate(
  beforeIso: string | null,
  afterIso: string | null,
  tz: string
): string {
  let candidate: number
  if (beforeIso && afterIso) {
    candidate = (new Date(beforeIso).getTime() + new Date(afterIso).getTime()) / 2
  } else if (afterIso) {
    candidate = new Date(afterIso).getTime() + DAY_MS
  } else if (beforeIso) {
    candidate = new Date(beforeIso).getTime() - DAY_MS
  } else {
    candidate = now().getTime() + DAY_MS
  }
  return ensureFuture(clampToWindow(new Date(candidate).toISOString(), tz))
}

/** Décale une date ISO de n jours. */
export function shiftDays(iso: string, daysCount: number): string {
  return new Date(new Date(iso).getTime() + daysCount * DAY_MS).toISOString()
}

/** Date de reprogrammation par défaut après un échec : demain, fenêtre 9–21 h. */
export function retryDate(tz: string): string {
  return ensureFuture(clampToWindow(shiftDays(now().toISOString(), 1), tz))
}
