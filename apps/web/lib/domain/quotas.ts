import type { Platform } from "@/lib/domain"
import type { MessageKey } from "@/lib/i18n"

// Quotas plateformes (CLAUDE.md §6) — l'UI affiche le restant ; l'enforcement
// réel est côté worker/DB (getQuotaUsage lit social_account_quota_usage, Phase 4).
export const PLATFORM_QUOTAS: Partial<
  Record<Platform, { limit: number; windowKey: MessageKey }>
> = {
  instagram: { limit: 100, windowKey: "quota.window.ig" },
  facebook: { limit: 30, windowKey: "quota.window.fb" },
  tiktok: { limit: 5, windowKey: "quota.window.tt" },
}
