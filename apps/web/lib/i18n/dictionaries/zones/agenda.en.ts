import type { agendaFr } from "./agenda.fr"
// Namespace i18n « agenda » (EN) — doit refléter les clés de agendaFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const agendaEn: Widen<typeof agendaFr> = {
  agenda: {},
}
