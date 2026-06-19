import type { clientsFr } from "./clients.fr"
// Namespace i18n « clients » (EN) — doit refléter les clés de clientsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const clientsEn: Widen<typeof clientsFr> = {
  clients: {},
}
