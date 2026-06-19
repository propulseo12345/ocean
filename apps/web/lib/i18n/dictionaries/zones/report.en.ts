import type { reportFr } from "./report.fr"
// Namespace i18n « report » (EN) — doit refléter les clés de reportFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const reportEn: Widen<typeof reportFr> = {
  report: {},
}
