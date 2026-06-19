import type { portalFr } from "./portal.fr"
// Namespace i18n « portal » (EN) — doit refléter les clés de portalFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const portalEn: Widen<typeof portalFr> = {
  portal: {},
}
