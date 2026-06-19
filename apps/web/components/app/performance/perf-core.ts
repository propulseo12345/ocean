import type { MessageKey } from "@/lib/i18n"
import type { EngagementStats } from "@/lib/mocks/types"

// Socle de la page Performance : modèle de période + primitives de calcul,
// partagés par perf-data.ts et perf-breakdown.ts. Déterministe, sans réseau.

export type PerfPeriod = "30d" | "month" | "90d"

// « days » = nombre de jours de la fenêtre. Pour « Mois en cours », 11 jours
// correspond au 1er → MOCK_NOW (11 juin 2026) : c'est volontairement plus court
// que 30j, ce qui distingue bien les deux périodes (count et stales différents).
// labelKey/previousKey = clés i18n résolues à l'affichage via t().
export const PERIOD_META: Record<
  PerfPeriod,
  { labelKey: MessageKey; days: number; previousKey: MessageKey }
> = {
  "30d": {
    labelKey: "performance.period.30d",
    days: 30,
    previousKey: "performance.period.prev30d",
  },
  month: {
    labelKey: "performance.period.month",
    days: 11,
    previousKey: "performance.period.prevMonth",
  },
  "90d": {
    labelKey: "performance.period.90d",
    days: 90,
    previousKey: "performance.period.prev90d",
  },
}

// Facteurs déterministes par période : la fenêtre courte échantillonne moins
// de posts (multiplicateur < 1) et l'écart vs période précédente diffère.
export const PERIOD_FACTOR: Record<PerfPeriod, { share: number; prevDelta: number }> = {
  "30d": { share: 0.62, prevDelta: 0.18 },
  month: { share: 0.34, prevDelta: 0.27 },
  "90d": { share: 1, prevDelta: 0.09 },
}

export function engagementOf(s: EngagementStats): number {
  return s.likes + s.comments + s.saves
}

export function rateOf(s: EngagementStats): number {
  return s.reach > 0 ? (engagementOf(s) / s.reach) * 100 : 0
}

export function scaleStats(s: EngagementStats, factor: number): EngagementStats {
  return {
    likes: Math.round(s.likes * factor),
    comments: Math.round(s.comments * factor),
    reach: Math.round(s.reach * factor),
    saves: Math.round(s.saves * factor),
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
