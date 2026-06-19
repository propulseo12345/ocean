import { INTL_LOCALE, type Locale } from "@/lib/i18n/config"

// Helpers d'affichage de la page Performance (formats compacts localisés + heatmap
// mockée des meilleurs créneaux). Aucune dépendance réseau, déterministe.

/** Nombre compact localisé : 1 720 → « 1,7 k » (fr) / "1.7k" (en). */
export function compactNumber(n: number, locale: Locale): string {
  if (n >= 1000) {
    const sep = locale === "fr" ? "," : "."
    const v = (n / 1000).toFixed(1).replace(".0", "").replace(".", sep)
    return locale === "fr" ? `${v} k` : `${v}k`
  }
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(n)
}

/** Nombre entier formaté avec séparateur de milliers selon la locale. */
export function fullNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(Math.round(n))
}

/** Pourcentage avec une décimale, ex. « 8,4 % » (fr) / "8.4%" (en). */
export function percent(n: number, locale: Locale, digits = 1): string {
  const sep = locale === "fr" ? "," : "."
  const v = n.toFixed(digits).replace(".", sep)
  return locale === "fr" ? `${v} %` : `${v}%`
}

/** Variation signée, ex. « +18 % » / « −5,4 % » (tiret typographique). */
export function signedPercent(n: number, locale: Locale): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  const sep = locale === "fr" ? "," : "."
  const v = Math.abs(n).toFixed(1).replace(".0", "").replace(".", sep)
  return locale === "fr" ? `${sign}${v} %` : `${sign}${v}%`
}

// Clés i18n des jours (lun → dim), résolues à l'affichage via t("performance.weekday.*").
export const WEEKDAY_KEYS = [
  "performance.weekday.mon",
  "performance.weekday.tue",
  "performance.weekday.wed",
  "performance.weekday.thu",
  "performance.weekday.fri",
  "performance.weekday.sat",
  "performance.weekday.sun",
] as const
export const HEAT_HOURS = [7, 9, 11, 13, 15, 17, 19, 21] as const

// Matrice d'intensité mockée (0–1) jour × heure : pics midi et 18–19 h,
// week-end plus calme. Déterministe — sert d'estimation « historique ».
const HEAT_BASE = [12, 38, 22, 14, 30, 78, 92, 40]

export function heatIntensity(dayIdx: number, hourIdx: number): number {
  const base = HEAT_BASE[hourIdx] ?? 20
  const dayMod = [1, 0.92, 1.05, 0.98, 1.12, 0.7, 0.6][dayIdx] ?? 1
  const ripple = ((dayIdx * 7 + hourIdx * 13) % 11) / 40
  return Math.min(1, (base / 100) * dayMod + ripple * 0.18)
}

/** Le meilleur créneau (index jour + heure) de la heatmap, pour la légende. */
export function bestSlot(): { dayIdx: number; hour: number } {
  let best = { day: 0, hour: 0, v: -1 }
  for (let d = 0; d < WEEKDAY_KEYS.length; d++) {
    for (let h = 0; h < HEAT_HOURS.length; h++) {
      const v = heatIntensity(d, h)
      if (v > best.v) best = { day: d, hour: h, v }
    }
  }
  return { dayIdx: best.day, hour: HEAT_HOURS[best.hour] }
}
