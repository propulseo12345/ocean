import type { Locale } from "../config"
import { en } from "./en"
import { type Dictionary, type FrDictionary, fr } from "./fr"

export type { Dictionary } from "./fr"

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en }

// Aplatissement récursif d'un dictionnaire imbriqué en map "a.b.c" -> message.
function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object") {
      flatten(value as Record<string, unknown>, path, out)
    } else if (typeof value === "string") {
      out[path] = value
    }
  }
  return out
}

const FLAT: Record<Locale, Record<string, string>> = {
  fr: flatten(fr),
  en: flatten(en),
}

// Type des clés valides (chemins pointés), dérivé de la forme du dictionnaire.
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : K) : never
type Paths<T> = T extends object
  ? { [K in keyof T]: T[K] extends string ? K & string : Join<K & string, Paths<T[K]>> }[keyof T]
  : never

export type MessageKey = Paths<FrDictionary>

export function getMessage(locale: Locale, key: string): string {
  // Fallback FR si une clé manque dans la locale (sécurité runtime).
  return FLAT[locale][key] ?? FLAT.fr[key] ?? key
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
