import type { studioFr } from "./studio.fr"
// Namespace i18n « studio » (EN) — doit refléter les clés de studioFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const studioEn: Widen<typeof studioFr> = {
  studio: {},
}
