import type { settingsFr } from "./settings.fr"
// Namespace i18n « settings » (EN) — doit refléter les clés de settingsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const settingsEn: Widen<typeof settingsFr> = {
  settings: {},
}
