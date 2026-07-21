import type { L, MessageKey } from "@/lib/i18n"
import { getContentItems, getPillars, getPostMetrics, getSocialAccounts } from "@/lib/mocks"
import type { Platform, SocialAccount } from "@/lib/mocks/types"
import { engagementOf, PERIOD_FACTOR, type PerfPeriod, round1, scaleStats } from "./perf-core"
import type { PostRow } from "./perf-data"

// Répartitions par pilier éditorial et comparatif par plateforme.
// Séparé de perf-data.ts pour tenir la limite de taille de fichier.

export interface PillarSlice {
  id: string
  name: string
  colorVar: string
  targetShare: number
  posts: number
  postShare: number
  engagement: number
  engagementShare: number
}

export function getPillarSplit(clientId: string, period: PerfPeriod): PillarSlice[] {
  const pillars = getPillars(clientId)
  const factor = PERIOD_FACTOR[period].share
  const measured = getContentItems(clientId)
    .map((c) => {
      const m = getPostMetrics(c.id)
      return m && c.pillarId
        ? { pillarId: c.pillarId, eng: engagementOf(scaleStats(m, factor)) }
        : null
    })
    .filter((x): x is { pillarId: string; eng: number } => x !== null)
  const totalPosts = measured.length || 1
  const totalEng = measured.reduce((n, x) => n + x.eng, 0) || 1
  return pillars.map((p) => {
    const own = measured.filter((x) => x.pillarId === p.id)
    const eng = own.reduce((n, x) => n + x.eng, 0)
    return {
      id: p.id,
      name: p.name,
      colorVar: p.colorVar,
      targetShare: p.targetShare,
      posts: own.length,
      postShare: round1((own.length / totalPosts) * 100),
      engagement: eng,
      engagementShare: round1((eng / totalEng) * 100),
    }
  })
}

export interface PlatformRow {
  platform: Platform
  account: SocialAccount | undefined
  measurable: boolean
  posts: number
  reach: number
  engagement: number
  rate: number
  /** Clé i18n d'une note explicative, résolue à l'affichage via t(). */
  noteKey?: MessageKey
}

// Comparatif par plateforme. TikTok = brouillon → aucune statistique API.
export function getPlatformRows(clientId: string, posts: PostRow[]): PlatformRow[] {
  const accounts = getSocialAccounts(clientId)
  const platforms: Platform[] = ["instagram", "facebook", "tiktok"]
  const present = platforms.filter((p) => accounts.some((a) => a.platform === p))
  return present.map((platform) => {
    const account = accounts.find((a) => a.platform === platform)
    if (platform === "tiktok") {
      return {
        platform,
        account,
        measurable: false,
        posts: 0,
        reach: 0,
        engagement: 0,
        rate: 0,
        noteKey: "performance.platform.noteDraft",
      }
    }
    // IG porte l'essentiel ; FB reçoit une fraction déterministe (≈ 35 %).
    const share = platform === "instagram" ? 1 : 0.35
    const subset = posts.filter((p) => p.platforms.includes(platform))
    const reach = Math.round(subset.reduce((n, p) => n + p.stats.reach, 0) * share)
    const engagement = Math.round(subset.reduce((n, p) => n + p.engagement, 0) * share)
    return {
      platform,
      account,
      measurable: true,
      posts: subset.length,
      reach,
      engagement,
      rate: reach > 0 ? round1((engagement / reach) * 100) : 0,
      noteKey: platform === "facebook" ? "performance.platform.noteFbLimited" : undefined,
    }
  })
}
