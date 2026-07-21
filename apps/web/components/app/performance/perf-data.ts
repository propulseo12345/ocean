import { now } from "@/lib/clock"
import {
  getContentItems,
  getImportedPosts,
  getPillars,
  getPostMetricsBatch,
  getSocialAccounts,
} from "@/lib/data"
import { formatDayMonth } from "@/lib/format"
import { createTranslator } from "@/lib/i18n"
import type {
  ContentFormat,
  ContentItem,
  ContentPillar,
  EngagementStats,
  ImportedPost,
  Platform,
  PostMetrics,
  SocialAccount,
} from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import {
  getPillarSplit,
  getPlatformRows,
  type PillarSlice,
  type PlatformRow,
} from "./perf-breakdown"
import { engagementOf, type PerfPeriod, periodStartMs, rateOf } from "./perf-core"

// Couche de données de la page Performance — RÉELLE (post_metrics via Supabase).
// Le seed ne pose pas de post_metrics (écriture service_role exclusive) : la page
// est donc VIDE en ligne tant que le worker n'a pas collecté de métriques. C'est
// attendu ; l'important est qu'elle ne CRASHE pas et n'affiche aucun chiffre inventé.

export type { PillarSlice, PlatformRow } from "./perf-breakdown"
export type { PerfPeriod } from "./perf-core"
// PERIOD_META n'est PAS ré-exporté ici : les composants client doivent l'importer
// depuis ./perf-core (perf-data importe @/lib/data, server-only via next/headers).

export interface PostRow {
  refId: string
  title: string
  thumbUrl: string
  format: ContentFormat
  platforms: Platform[]
  /** Pilier éditorial (contenus Ocean) ; null pour un post importé. */
  pillarId: string | null
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
    pillarId: c.pillarId ?? null,
    permalink: ig?.permalink,
    href: routes.content(c.clientId, c.id),
    publishedAt: ig?.publishedAt ?? c.scheduledAt ?? c.createdAt,
    stats: m,
    engagement: engagementOf(m),
    engagementRate: rateOf(m),
  }
}

// Un post importé n'a pas de titre éditorial : on le dérive de sa date (D1, FR).
const tFr = createTranslator("fr")

function importedRow(p: ImportedPost, m: EngagementStats, tz: string): PostRow {
  return {
    refId: p.id,
    title: tFr("performance.posts.importedTitle", {
      date: formatDayMonth(p.publishedAt, tz, "fr"),
    }),
    thumbUrl: p.thumbUrl,
    format: p.mediaType === "video" ? "reel" : "post",
    platforms: ["instagram"],
    pillarId: null,
    permalink: p.permalink,
    publishedAt: p.publishedAt,
    stats: m,
    engagement: engagementOf(m),
    engagementRate: rateOf(m),
  }
}

/** Publications MESURÉES (métriques réelles présentes), toutes périodes confondues. */
function buildAllRows(
  content: ContentItem[],
  imported: ImportedPost[],
  metrics: Map<string, PostMetrics>,
  tz: string
): PostRow[] {
  const rows: PostRow[] = []
  for (const c of content) {
    const m = metrics.get(c.id)
    if (m) rows.push(contentRow(c, m))
  }
  for (const p of imported) {
    const m = metrics.get(p.id)
    if (m) rows.push(importedRow(p, m, tz))
  }
  return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/** Posts publiés DANS la fenêtre de la période (dates réelles, sans mise à l'échelle). */
function postsInPeriod(all: PostRow[], period: PerfPeriod): PostRow[] {
  const start = periodStartMs(period, now().getTime())
  return all.filter((p) => new Date(p.publishedAt).getTime() >= start)
}

export interface KpiValue {
  reach: number
  engagement: number
  rate: number
  count: number
}

export type KpiDelta = { reach: number; engagement: number; rate: number; count: number }

export interface KpiWithDelta {
  current: KpiValue
  /**
   * Variation vs période précédente. `null` = NON DISPONIBLE : post_metrics est
   * un instantané, pas une série temporelle — aucune comparaison N-1 fiable. On
   * affiche « — », jamais un delta fabriqué dans un rapport destiné au client.
   */
  delta: KpiDelta | null
}

export function getKpis(posts: PostRow[]): KpiWithDelta {
  const reach = posts.reduce((n, p) => n + p.stats.reach, 0)
  const engagement = posts.reduce((n, p) => n + p.engagement, 0)
  const count = posts.length
  const rate = reach > 0 ? (engagement / reach) * 100 : 0
  return { current: { reach, engagement, rate, count }, delta: null }
}

export interface TrendBucket {
  /** Rang 1-based de la tranche ; libellé « P{index} » assemblé à l'affichage. */
  index: number
  reach: number
  engagement: number
}

// Répartit les posts en N tranches égales sur la fenêtre de la période (dates réelles).
export function getTrend(posts: PostRow[], period: PerfPeriod): TrendBucket[] {
  const bucketCount = period === "90d" ? 6 : 4
  const nowMs = now().getTime()
  const start = periodStartMs(period, nowMs)
  const span = Math.max(nowMs - start, 1)
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

function periodData(
  all: PostRow[],
  period: PerfPeriod,
  pillars: ContentPillar[],
  accounts: SocialAccount[]
): PerfPeriodData {
  const posts = postsInPeriod(all, period)
  return {
    posts,
    kpis: getKpis(posts),
    trend: getTrend(posts, period),
    pillars: getPillarSplit(pillars, posts),
    platforms: getPlatformRows(accounts, posts),
  }
}

/** Charge les données réelles une fois puis calcule les trois périodes en mémoire. */
async function loadRows(orgId: string, clientId: string, tz: string) {
  const [content, imported, pillars, accounts] = await Promise.all([
    getContentItems(orgId, clientId),
    getImportedPosts(orgId, clientId),
    getPillars(orgId, clientId),
    getSocialAccounts(orgId, clientId),
  ])
  const refIds = [...content.map((c) => c.id), ...imported.map((p) => p.id)]
  const metrics = await getPostMetricsBatch(orgId, refIds)
  return { all: buildAllRows(content, imported, metrics, tz), pillars, accounts }
}

/** Jeu de données complet d'un client pour les trois périodes. */
export async function getAllPerfData(
  orgId: string,
  clientId: string,
  tz: string
): Promise<Record<PerfPeriod, PerfPeriodData>> {
  const { all, pillars, accounts } = await loadRows(orgId, clientId, tz)
  return {
    "30d": periodData(all, "30d", pillars, accounts),
    month: periodData(all, "month", pillars, accounts),
    "90d": periodData(all, "90d", pillars, accounts),
  }
}

/** Jeu de données d'une seule période (rapport client). */
export async function getPerfPeriodData(
  orgId: string,
  clientId: string,
  period: PerfPeriod,
  tz: string
): Promise<PerfPeriodData> {
  const { all, pillars, accounts } = await loadRows(orgId, clientId, tz)
  return periodData(all, period, pillars, accounts)
}
