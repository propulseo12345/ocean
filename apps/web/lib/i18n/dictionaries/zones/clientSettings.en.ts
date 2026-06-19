import type { clientSettingsFr } from "./clientSettings.fr"
// Namespace i18n « clientSettings » (EN) — doit refléter les clés de clientSettingsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const clientSettingsEn: Widen<typeof clientSettingsFr> = {
  clientSettings: {},
}
