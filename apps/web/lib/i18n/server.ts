import "server-only"
import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale, LOCALES } from "./config"
import { type Format, makeFormat } from "./format-bound"
import { type Labels, makeLabels } from "./labels"
import { createTranslator, type Translator } from "./translator"

// Détection de la langue préférée du navigateur (premier passage, sans cookie).
function detectFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  for (const { tag } of ranked) {
    const base = tag.split("-")[0]
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale
  }
  return DEFAULT_LOCALE
}

// Locale active côté serveur : cookie prioritaire, sinon Accept-Language, sinon défaut.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie
  const headerStore = await headers()
  return detectFromHeader(headerStore.get("accept-language"))
}

// Traducteur prêt à l'emploi dans un Server Component / page.
export async function getT(): Promise<Translator> {
  return createTranslator(await getLocale())
}

// Résolveurs de libellés localisés (statuts, formats, plateformes) côté serveur.
export async function getLabels(): Promise<Labels> {
  return makeLabels(await getT())
}

// Formatteurs date/heure/nombre pré-liés à la locale active, côté serveur.
export async function getFormat(): Promise<Format> {
  return makeFormat(await getLocale())
}
