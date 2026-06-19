import type { navFr } from "./nav.fr"
// Namespace i18n « nav » (EN) — doit refléter les clés de navFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const navEn: Widen<typeof navFr> = {
  nav: {},
}
