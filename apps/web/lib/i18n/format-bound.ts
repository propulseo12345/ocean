import {
  DEFAULT_TZ,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatFollowers,
  formatRelative,
  formatTime,
  formatWeekday,
} from "@/lib/format"
import type { Locale } from "./config"

// Formatteurs de date/heure/nombre pré-liés à la locale active.
// Usage client : const f = useFormat(); f.date(iso, tz)
// Usage serveur : const f = await getFormat(); f.date(iso, tz)
export function makeFormat(locale: Locale) {
  return {
    locale,
    date: (iso: string, tz: string = DEFAULT_TZ) => formatDate(iso, tz, locale),
    dayMonth: (iso: string, tz: string = DEFAULT_TZ) => formatDayMonth(iso, tz, locale),
    weekday: (iso: string, tz: string = DEFAULT_TZ) => formatWeekday(iso, tz, locale),
    time: (iso: string, tz: string = DEFAULT_TZ) => formatTime(iso, tz, locale),
    dateTime: (iso: string, tz: string = DEFAULT_TZ) => formatDateTime(iso, tz, locale),
    relative: (iso: string) => formatRelative(iso, locale),
    followers: (n: number) => formatFollowers(n, locale),
  }
}

export type Format = ReturnType<typeof makeFormat>
