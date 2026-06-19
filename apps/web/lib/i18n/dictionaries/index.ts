import type { Locale } from "../config"
import { en } from "./en"
import { type Dictionary, type FrDictionary, fr } from "./fr"
import { zonesEn } from "./zones/en"
import { zonesFr } from "./zones/fr"

export type { Dictionary } from "./fr"

// Dictionnaire complet = base (fr/en) + namespaces de zones UI (un fichier par zone).
const FR_FULL = { ...fr, ...zonesFr }
const EN_FULL = { ...en, ...zonesEn }

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
  fr: flatten(FR_FULL),
  en: flatten(EN_FULL),
}

// Type des clés valides (chemins pointés), dérivé de la forme du dictionnaire complet.
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : K) : never
type Paths<T> = T extends object
  ? { [K in keyof T]: T[K] extends string ? K & string : Join<K & string, Paths<T[K]>> }[keyof T]
  : never

export type MessageKey = Paths<FrDictionary & typeof zonesFr>

export function getMessage(locale: Locale, key: string): string {
  // Fallback FR si une clé manque dans la locale (sécurité runtime).
  return FLAT[locale][key] ?? FLAT.fr[key] ?? key
}
