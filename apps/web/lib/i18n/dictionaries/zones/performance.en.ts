import type { performanceFr } from "./performance.fr"
// Namespace i18n « performance » (EN) — doit refléter les clés de performanceFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const performanceEn: Widen<typeof performanceFr> = {
  performance: {},
}
