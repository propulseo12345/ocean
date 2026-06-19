// Point d'entrée i18n. Côté serveur, importer depuis "@/lib/i18n/server".
export {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_LABEL,
  type Locale,
  LOCALES,
} from "./config"
export { type Dictionary, type MessageKey } from "./dictionaries"
export { type MessageParams } from "./format-message"
export { type L, loc, pick } from "./localized"
export { LocaleProvider, useLocale, useT } from "./provider"
export { createTranslator, type Translator } from "./translator"
