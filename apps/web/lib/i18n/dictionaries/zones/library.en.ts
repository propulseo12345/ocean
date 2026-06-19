import type { libraryFr } from "./library.fr"
// Namespace i18n « library » (EN) — doit refléter les clés de libraryFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const libraryEn: Widen<typeof libraryFr> = {
  library: {},
}
