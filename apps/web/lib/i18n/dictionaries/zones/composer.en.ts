import type { composerFr } from "./composer.fr"
// Namespace i18n « composer » (EN) — doit refléter les clés de composerFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const composerEn: Widen<typeof composerFr> = {
  composer: {},
}
