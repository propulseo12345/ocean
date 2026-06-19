import type { MessageKey } from "@/lib/i18n"
import { SOCIAL_ACCOUNTS } from "./clients"
import { CONTENT_ITEMS } from "./content"
import { days, fromNow, MOCK_NOW } from "./time"
import type { Platform, QuotaUsage } from "./types"

// Quotas plateformes (CLAUDE.md §6) — l'UI affiche, l'enforcement réel sera
// côté worker/DB. used = base simulée (activité hors mocks) + activité mockée
// des dernières 24 h.

export const PLATFORM_QUOTAS: Partial<Record<Platform, { limit: number; windowKey: MessageKey }>> =
  {
    instagram: { limit: 100, windowKey: "quota.window.ig" },
    facebook: { limit: 30, windowKey: "quota.window.fb" },
    tiktok: { limit: 5, windowKey: "quota.window.tt" },
  }

// Consommation simulée par compte (Maison Verde volontairement proche des
// limites pour la jauge : IG 87/100, FB Reels 29/30, TikTok 3+1/5).
const BASE_USAGE: Record<string, number> = {
  sa_bru_ig: 12,
  sa_bru_fb: 3,
  sa_ver_ig: 87,
  sa_ver_fb: 29,
  sa_ver_tt: 3,
  sa_nov_ig: 41,
  sa_nov_tt: 1,
  sa_ris_ig: 8,
  sa_ris_fb: 2,
}

const WINDOW_START = fromNow(-days(1))
const WINDOW_END = MOCK_NOW.toISOString()

function inWindow(iso?: string): boolean {
  return Boolean(iso && iso > WINDOW_START && iso <= WINDOW_END)
}

// Activité mockée comptant dans le quota : IG = posts publiés, FB = Reels
// publiés, TikTok = brouillons poussés (sur les dernières 24 h).
function mockUsage(accountId: string, platform: Platform): number {
  let count = 0
  for (const item of CONTENT_ITEMS) {
    if (platform === "facebook" && item.format !== "reel") continue
    for (const target of item.targets) {
      if (target.socialAccountId !== accountId) continue
      const counts =
        target.status === "published" ||
        (platform === "tiktok" && target.status === "pushed_to_platform")
      if (counts && inWindow(target.publishedAt)) count++
    }
  }
  return count
}

/**
 * Consommation du quota d'un compte social.
 * Retourne null si le compte est inconnu ou sans quota plateforme (newsletter…).
 */
export function getQuotaUsage(accountId: string): QuotaUsage | null {
  const account = SOCIAL_ACCOUNTS.find((a) => a.id === accountId)
  if (!account) return null
  const quota = PLATFORM_QUOTAS[account.platform]
  if (!quota) return null
  const used = Math.min(
    quota.limit,
    (BASE_USAGE[accountId] ?? 0) + mockUsage(accountId, account.platform)
  )
  return { used, limit: quota.limit, windowKey: quota.windowKey }
}
