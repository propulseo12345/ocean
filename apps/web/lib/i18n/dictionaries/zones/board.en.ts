import type { boardFr } from "./board.fr"
// Namespace i18n « board » (EN) — doit refléter les clés de boardFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const boardEn: Widen<typeof boardFr> = {
  board: {},
}
