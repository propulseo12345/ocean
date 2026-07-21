import { now } from "@/lib/clock"
import { formatDayMonth } from "@/lib/format"
import { createTranslator, type L } from "@/lib/i18n"
import { getContentItems, getImportedPosts, getPostMetrics } from "@/lib/mocks"
import type {
  ContentFormat,
  ContentItem,
  EngagementStats,
  ImportedPost,
  Platform,
} from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import {
  getPillarSplit,
  getPlatformRows,
  type PillarSlice,
  type PlatformRow,
} from "./perf-breakdown"
import {
  engagementOf,
  PERIOD_FACTOR,
  PERIOD_META,
  type PerfPeriod,
  rateOf,
  round1,
  scaleStats,
} from "./perf-core"

// Couche de données de la page Performance — déterministe, sans réseau.
// Source : helpers mockés GELÉS (metrics, pillars, content, imported).
// Honnêteté : tout est dérivé de métriques mockées « d'illustration ».

export type { PillarSlice, PlatformRow } from "./perf-breakdown"
export type { PerfPeriod } from "./perf-core"
export { PERIOD_META } from "./perf-core"

export interface PostRow {
  refId: string
  title: string
  thumbUrl: string
  format: ContentFormat
  platforms: Platform[]
  permalink?: string
  href?: string
  publishedAt: string
  stats: EngagementStats
  engagement: number
  engagementRate: number
}

function contentRow(c: ContentItem, m: EngagementStats): PostRow {
  const ig = c.targets.find((t) => t.platform === "instagram")
  return {
    refId: c.id,
    title: c.title,
    thumbUrl: c.media[0]?.thumbUrl ?? "",
    format: c.format,
    platforms: c.targets.map((t) => t.platform),
    permalink: ig?.permalink,
    href: routes.content(c.clientId, c.id),
    publishedAt: ig?.publishedAt ?? c.scheduledAt ?? c.createdAt,
    stats: m,
    engagement: engagementOf(m),
    engagementRate: rateOf(m),
  }
}

// Traducteurs locale-figés : un post importé n'a pas de titre éditorial, on le
// dérive de sa date dans les deux langues (pré-rendu côté serveur, puis pick()).
const tFr = createTranslator("fr")

function importedRow(p: ImportedPost, m: EngagementStats, tz: string): PostRow {
  return {
    refId: p.id,
    // Titre monolingue (D1).
    title: tFr("performance.posts.importedTitle", {
      date: formatDayMonth(p.publishedAt, tz, "fr"),
    }),
    thumbUrl: p.thumbUrl,
    format: p.mediaType === "video" ? "reel" : "post",
    platforms: ["instagram"],
    permalink: p.permalink,
    publishedAt: p.publishedAt,
    stats: m,
    engagement: engagementOf(m),
    engagementRate: rateOf(m),
  }
}

/** Toutes les publications mesurées d'un client, mises à l'échelle de la période. */
export function getPerfPosts(clientId: string, period: PerfPeriod, tz: string): PostRow[] {
  const factor = PERIOD_FACTOR[period].share
  const rows: PostRow[] = []
  for (const c of getContentItems(clientId)) {
    const m = getPostMetrics(c.id)
    if (m) rows.push(contentRow(c, scaleStats(m, factor)))
  }
  for (const p of getImportedPosts(clientId)) {
    const m = getPostMetrics(p.id)
    if (m) rows.push(importedRow(p, scaleStats(m, factor), tz))
  }
  return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export interface KpiValue {
  reach: number
  engagement: number
  rate: number
  count: number
}

export interface KpiWithDelta {
  current: KpiValue
  /** Variation en % vs période précédente (déterministe, peut être négative). */
  delta: { reach: number; engagement: number; rate: number; count: number }
}

// Variations déterministes par métrique (signe et amplitude figés par période).
const DELTA_SHAPE = { reach: 1, engagement: 1.4, rate: 0.6, count: -0.5 }

export function getKpis(posts: PostRow[], period: PerfPeriod): KpiWithDelta {
  const reach = posts.reduce((n, p) => n + p.stats.reach, 0)
  const engagement = posts.reduce((n, p) => n + p.engagement, 0)
  // Le nombre de publications suit le facteur de période, comme les stats
  // (scaleStats) : une fenêtre courte échantillonne moins de posts. Sans cela,
  // « 90j » et « mois » afficheraient le même count, ce qui est trompeur.
  const count = Math.round(posts.length * PERIOD_FACTOR[period].share)
  const rate = reach > 0 ? (engagement / reach) * 100 : 0
  const base = PERIOD_FACTOR[period].prevDelta
  return {
    current: { reach, engagement, rate, count },
    delta: {
      reach: round1(base * 100 * DELTA_SHAPE.reach),
      engagement: round1(base * 100 * DELTA_SHAPE.engagement),
      rate: round1(base * 100 * DELTA_SHAPE.rate),
      count: round1(base * 100 * DELTA_SHAPE.count),
    },
  }
}

export interface TrendBucket {
  /** Rang 1-based de la tranche ; libellé « P{index} » assemblé à l'affichage. */
  index: number
  reach: number
  engagement: number
}

// Répartit les posts en N tranches égales régressives depuis MOCK_NOW. Les
// libellés sont génériques (« P1..P4 ») : un bucket ne couvre pas forcément une
// semaine (ex. « mois » = 11 j / 4 ≈ 2,75 j), donc on évite « S1..S4 ».
export function getTrend(posts: PostRow[], period: PerfPeriod): TrendBucket[] {
  const bucketCount = period === "90d" ? 6 : 4
  const dayMs = 86_400_000
  const span = PERIOD_META[period].days * dayMs
  const start = now().getTime() - span
  const buckets: TrendBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    index: i + 1,
    reach: 0,
    engagement: 0,
  }))
  for (const p of posts) {
    const t = new Date(p.publishedAt).getTime()
    const idx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(((t - start) / span) * bucketCount))
    )
    buckets[idx].reach += p.stats.reach
    buckets[idx].engagement += p.engagement
  }
  return buckets
}

export interface PerfPeriodData {
  posts: PostRow[]
  kpis: KpiWithDelta
  trend: TrendBucket[]
  pillars: PillarSlice[]
  platforms: PlatformRow[]
}

/** Construit le jeu de données complet d'un client pour une période donnée. */
export function getPerfPeriodData(
  clientId: string,
  period: PerfPeriod,
  tz: string
): PerfPeriodData {
  const posts = getPerfPosts(clientId, period, tz)
  return {
    posts,
    kpis: getKpis(posts, period),
    trend: getTrend(posts, period),
    pillars: getPillarSplit(clientId, period),
    platforms: getPlatformRows(clientId, posts),
  }
}

/** Jeu de données pour les trois périodes (pré-calculé côté serveur). */
export function getAllPerfData(clientId: string, tz: string): Record<PerfPeriod, PerfPeriodData> {
  return {
    "30d": getPerfPeriodData(clientId, "30d", tz),
    month: getPerfPeriodData(clientId, "month", tz),
    "90d": getPerfPeriodData(clientId, "90d", tz),
  }
}
