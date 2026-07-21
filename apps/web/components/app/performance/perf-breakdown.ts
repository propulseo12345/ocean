import type { ContentPillar, Platform, SocialAccount } from "@/lib/domain"
import type { MessageKey } from "@/lib/i18n"
import { round1 } from "./perf-core"
import type { PostRow } from "./perf-data"

// Répartitions par pilier éditorial et comparatif par plateforme.
// Séparé de perf-data.ts pour tenir la limite de taille de fichier.
// Tout est dérivé des posts MESURÉS de la période (métriques réelles) — aucune
// mise à l'échelle ni fraction inventée.

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

export function getPillarSplit(pillars: ContentPillar[], posts: PostRow[]): PillarSlice[] {
  const measured = posts
    .filter((p) => p.pillarId !== null)
    .map((p) => ({ pillarId: p.pillarId as string, eng: p.engagement }))
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

// Comparatif par plateforme. TikTok = brouillon → aucune statistique API. Les
// métriques d'un post sont agrégées sur ses cibles : un post multi-plateformes
// compte pour chacune (limite assumée), mais sans chiffre fabriqué.
export function getPlatformRows(accounts: SocialAccount[], posts: PostRow[]): PlatformRow[] {
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
    const subset = posts.filter((p) => p.platforms.includes(platform))
    const reach = subset.reduce((n, p) => n + p.stats.reach, 0)
    const engagement = subset.reduce((n, p) => n + p.engagement, 0)
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
