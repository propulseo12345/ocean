import type { calendarFr } from "./calendar.fr"
// Namespace i18n « calendar » (EN) — doit refléter les clés de calendarFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const calendarEn: Widen<typeof calendarFr> = {
  calendar: {},
}
