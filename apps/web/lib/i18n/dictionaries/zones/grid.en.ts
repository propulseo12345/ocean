import type { gridFr } from "./grid.fr"
// Namespace i18n « grid » (EN) — doit refléter les clés de gridFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const gridEn: Widen<typeof gridFr> = {
  grid: {},
}
