// Helpers d'affichage de la page Performance (formats compacts FR + heatmap
// mockée des meilleurs créneaux). Aucune dépendance réseau, déterministe.

/** Nombre compact FR : 1 720 → « 1,7 k », 24 300 → « 24,3 k ». */
export function compactNumber(n: number): string {
  if (n >= 1000) {
    const v = (n / 1000).toFixed(1).replace(".0", "").replace(".", ",")
    return `${v} k`
  }
  return new Intl.NumberFormat("fr-FR").format(n)
}

/** Nombre entier formaté FR avec séparateur de milliers. */
export function fullNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n))
}

/** Pourcentage FR avec une décimale, ex. « 8,4 % ». */
export function percent(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(".", ",")} %`
}

/** Variation signée, ex. « +18 % » / « −5,4 % » (tiret typographique). */
export function signedPercent(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return `${sign}${Math.abs(n).toFixed(1).replace(".0", "").replace(".", ",")} %`
}

export const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const
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

/** Le meilleur créneau (jour + heure) de la heatmap, pour la légende. */
export function bestSlotLabel(): string {
  let best = { day: 0, hour: 0, v: -1 }
  for (let d = 0; d < WEEKDAYS_FR.length; d++) {
    for (let h = 0; h < HEAT_HOURS.length; h++) {
      const v = heatIntensity(d, h)
      if (v > best.v) best = { day: d, hour: h, v }
    }
  }
  return `${WEEKDAYS_FR[best.day]}. ${HEAT_HOURS[best.hour]}h`
}
