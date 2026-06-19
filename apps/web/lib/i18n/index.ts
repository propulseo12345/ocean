// Point d'entrée i18n. Côté serveur, importer depuis "@/lib/i18n/server".
export {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_LABEL,
  LOCALES,
  type Locale,
} from "./config"
export type { Dictionary, MessageKey } from "./dictionaries"
export { type Format, makeFormat } from "./format-bound"
export type { MessageParams } from "./format-message"
export { type Labels, makeLabels } from "./labels"
export { type L, loc, pick } from "./localized"
export { LocaleProvider, useFormat, useLabels, useLocale, useT } from "./provider"
export { createTranslator, type Translator } from "./translator"
