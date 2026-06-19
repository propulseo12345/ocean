import { MOCK_NOW } from "@/lib/mocks/time"

export const DEFAULT_TZ = "Europe/Paris"

function fmt(opts: Intl.DateTimeFormatOptions, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, ...opts })
}

export function formatDate(iso: string, tz: string = DEFAULT_TZ): string {
  return fmt({ day: "numeric", month: "long", year: "numeric" }, tz).format(new Date(iso))
}

export function formatDayMonth(iso: string, tz: string = DEFAULT_TZ): string {
  return fmt({ day: "numeric", month: "short" }, tz).format(new Date(iso))
}

export function formatWeekday(iso: string, tz: string = DEFAULT_TZ): string {
  return fmt({ weekday: "long" }, tz).format(new Date(iso))
}

export function formatTime(iso: string, tz: string = DEFAULT_TZ): string {
  return fmt({ hour: "2-digit", minute: "2-digit" }, tz).format(new Date(iso))
}

export function formatDateTime(iso: string, tz: string = DEFAULT_TZ): string {
  const date = fmt({ weekday: "short", day: "numeric", month: "short" }, tz).format(new Date(iso))
  return `${date} · ${formatTime(iso, tz)}`
}

const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" })

export function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - MOCK_NOW.getTime()
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
  return new Date(iso).getTime() < MOCK_NOW.getTime()
}

export function isSameDay(iso: string, ref: Date = MOCK_NOW, tz = DEFAULT_TZ): boolean {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  return key(new Date(iso)) === key(ref)
}

export function formatFollowers(n: number): string {
  if (n >= 1000) {
    const v = (n / 1000).toFixed(1).replace(".0", "").replace(".", ",")
    return `${v} k`
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
