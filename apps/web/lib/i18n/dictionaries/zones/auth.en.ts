import type { authFr } from "./auth.fr"
// Namespace i18n « auth » (EN) — doit refléter les clés de authFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const authEn: Widen<typeof authFr> = {
  auth: {},
}
