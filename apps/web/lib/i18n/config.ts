// Configuration i18n — Ocean est bilingue FR/EN (preview front).
// La locale est persistée dans le cookie `ocean_locale`, lue côté serveur via
// cookies() et côté client via <LocaleProvider>. Aucun préfixe d'URL.

export const LOCALES = ["fr", "en"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fr"

export const LOCALE_COOKIE = "ocean_locale"
// Persistance ~1 an, lisible côté client (pas httpOnly : c'est une préférence UI).
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

// Locale formelle pour Intl (dates, nombres) selon la locale active.
export const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
}

// Libellé de la langue dans sa propre langue (toggle, sélecteurs).
export const LOCALE_LABEL: Record<Locale, string> = {
  fr: "Français",
  en: "English",
}
