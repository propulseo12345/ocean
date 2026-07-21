import type { EngagementStats } from "@/lib/domain"
import type { MessageKey } from "@/lib/i18n"

// Socle de la page Performance : modèle de période + primitives de calcul,
// partagés par perf-data.ts et perf-breakdown.ts.
//
// Honnêteté : les métriques sont RÉELLES (post_metrics, écriture service_role).
// Aucune mise à l'échelle ni delta inventé — une fenêtre sans données mesurées
// affiche des zéros et « — », jamais un chiffre fabriqué destiné au client.

export type PerfPeriod = "30d" | "month" | "90d"

// « days » = fenêtre glissante pour 30d/90d. « month » est traité à part
// (mois-à-date, cf. periodStartMs) — days n'y sert que de repli.
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
    days: 30,
    previousKey: "performance.period.prevMonth",
  },
  "90d": {
    labelKey: "performance.period.90d",
    days: 90,
    previousKey: "performance.period.prev90d",
  },
}

const DAY_MS = 86_400_000

/** Début de la fenêtre d'une période (ms epoch). « month » = 1er du mois courant (UTC). */
export function periodStartMs(period: PerfPeriod, nowMs: number): number {
  if (period === "month") {
    const d = new Date(nowMs)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  }
  return nowMs - PERIOD_META[period].days * DAY_MS
}

export function engagementOf(s: EngagementStats): number {
  return s.likes + s.comments + s.saves
}

export function rateOf(s: EngagementStats): number {
  return s.reach > 0 ? (engagementOf(s) / s.reach) * 100 : 0
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
