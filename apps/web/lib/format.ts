import { now } from "@/lib/clock"
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/lib/i18n/config"

export const DEFAULT_TZ = "Europe/Paris"

// Locale d'affichage (fr-FR / en-US) à partir de la locale active.
function intl(locale: Locale): string {
  return INTL_LOCALE[locale]
}

function fmt(opts: Intl.DateTimeFormatOptions, tz: string, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), { timeZone: tz, ...opts })
}

export function formatDate(iso: string, tz: string = DEFAULT_TZ, locale: Locale = DEFAULT_LOCALE) {
  return fmt({ day: "numeric", month: "long", year: "numeric" }, tz, locale).format(new Date(iso))
}

export function formatDayMonth(
  iso: string,
  tz: string = DEFAULT_TZ,
  locale: Locale = DEFAULT_LOCALE
) {
  return fmt({ day: "numeric", month: "short" }, tz, locale).format(new Date(iso))
}

export function formatWeekday(
  iso: string,
  tz: string = DEFAULT_TZ,
  locale: Locale = DEFAULT_LOCALE
) {
  return fmt({ weekday: "long" }, tz, locale).format(new Date(iso))
}

export function formatTime(iso: string, tz: string = DEFAULT_TZ, locale: Locale = DEFAULT_LOCALE) {
  return fmt({ hour: "2-digit", minute: "2-digit" }, tz, locale).format(new Date(iso))
}

export function formatDateTime(
  iso: string,
  tz: string = DEFAULT_TZ,
  locale: Locale = DEFAULT_LOCALE
) {
  const date = fmt({ weekday: "short", day: "numeric", month: "short" }, tz, locale).format(
    new Date(iso)
  )
  return `${date} · ${formatTime(iso, tz, locale)}`
}

export function formatRelative(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: "auto" })
  const diff = new Date(iso).getTime() - now().getTime()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute")
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour")
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day")
  return rtf.format(Math.round(diff / (30 * day)), "month")
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < now().getTime()
}

// fr-CA est utilisé comme CLÉ technique stable YYYY-MM-DD (jamais affiché) — ne pas localiser.
export function isSameDay(iso: string, ref: Date = now(), tz = DEFAULT_TZ): boolean {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  return key(new Date(iso)) === key(ref)
}

export function formatFollowers(n: number, locale: Locale = DEFAULT_LOCALE): string {
  if (n >= 1000) {
    const v = (n / 1000).toFixed(1).replace(".0", "")
    // Séparateur décimal selon la locale (virgule en FR, point en EN).
    const sep = locale === "fr" ? "," : "."
    return `${v.replace(".", sep)} k`
  }
  return String(n)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}
