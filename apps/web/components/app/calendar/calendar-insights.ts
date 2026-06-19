import { MANUAL_PLATFORMS } from "@/lib/mocks/labels"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { ContentItem, ContentPillar, ContentStatus, SocialAccount } from "@/lib/mocks/types"
import { GAP_THRESHOLD_DAYS } from "./calendar-types"
import { type DayKey, dayKeyOf } from "./calendar-utils"

// Calculs dérivés du calendrier : trous de cadence, densité, mix de piliers,
// santé des comptes, attente de validation. Pur local, aucune dépendance API.

/** Statuts qui « comptent » dans la cadence publiée/planifiée. */
const CADENCE_STATUSES: ContentStatus[] = [
  "scheduled",
  "approved",
  "publishing",
  "published",
  "partially_published",
]

const DAY_MS = 86_400_000

function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS)
}

export interface CadenceGaps {
  /** Jours intérieurs des trous (pour le liseré pointillé). */
  gapDays: ReadonlySet<DayKey>
  count: number
}

/** Trous de cadence (> GAP_THRESHOLD_DAYS jours sans publication) dans le mois. */
export function cadenceGaps(
  monthKeys: DayKey[],
  byDay: ReadonlyMap<DayKey, ContentItem[]>
): CadenceGaps {
  const present = monthKeys.filter((k) =>
    (byDay.get(k) ?? []).some((it) => CADENCE_STATUSES.includes(it.status))
  )
  const gapDays = new Set<DayKey>()
  let count = 0
  for (let i = 1; i < present.length; i++) {
    const span = daysBetween(present[i - 1], present[i])
    if (span <= GAP_THRESHOLD_DAYS) continue
    count++
    const start = monthKeys.indexOf(present[i - 1])
    const end = monthKeys.indexOf(present[i])
    for (let j = start + 1; j < end; j++) gapDays.add(monthKeys[j])
  }
  return { gapDays, count }
}

/** Publications Instagram par jour (pastille de densité). */
export function igDensityByDay(
  byDay: ReadonlyMap<DayKey, ContentItem[]>
): ReadonlyMap<DayKey, number> {
  const out = new Map<DayKey, number>()
  for (const [key, items] of byDay) {
    const n = items.filter(
      (it) =>
        it.status !== "canceled" &&
        it.targets.some((t) => t.platform === "instagram" && t.status !== "canceled")
    ).length
    if (n > 0) out.set(key, n)
  }
  return out
}

/** Ids des contenus à venir dont un compte cible doit être reconnecté. */
export function accountIssueContentIds(
  items: ContentItem[],
  accounts: SocialAccount[]
): ReadonlySet<string> {
  const broken = new Set(accounts.filter((a) => a.status !== "connected").map((a) => a.id))
  if (broken.size === 0) return new Set()
  const out = new Set<string>()
  for (const it of items) {
    if (it.status === "published" || it.status === "canceled") continue
    if (it.targets.some((t) => t.socialAccountId !== null && broken.has(t.socialAccountId))) {
      out.add(it.id)
    }
  }
  return out
}

export type ManualKind = "tiktok" | "manual" | null

/** Canal manuel d'un contenu : brouillon TikTok, ou newsletter/sur-mesure. */
export function manualKindOf(item: ContentItem): ManualKind {
  if (item.targets.some((t) => t.platform === "tiktok")) return "tiktok"
  if (item.targets.some((t) => MANUAL_PLATFORMS.includes(t.platform))) return "manual"
  return null
}

/** Jours d'attente de validation par contenu (in_review / changes_requested). */
export function waitingDaysByContent(
  items: ContentItem[],
  reviewSentAt: string | null
): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  for (const it of items) {
    if (it.status !== "in_review" && it.status !== "changes_requested") continue
    const since = reviewSentAt ?? it.createdAt
    const days = Math.max(0, Math.floor((MOCK_NOW.getTime() - Date.parse(since)) / DAY_MS))
    out.set(it.id, days)
  }
  return out
}

export interface PillarMixRow {
  pillar: ContentPillar
  count: number
  /** Part réelle planifiée du mois, en %. */
  share: number
  /** Écart signalé si |share − targetShare| dépasse le seuil. */
  drift: boolean
}

const MIX_DRIFT_THRESHOLD = 10

/** Mix de piliers du mois affiché (part réelle vs part cible). */
export function pillarMix(monthItems: ContentItem[], pillars: ContentPillar[]): PillarMixRow[] {
  const counted = monthItems.filter((it) => it.status !== "canceled")
  const total = counted.length
  return pillars.map((pillar) => {
    const count = counted.filter((it) => it.pillarId === pillar.id).length
    const share = total > 0 ? Math.round((count / total) * 100) : 0
    return {
      pillar,
      count,
      share,
      drift: Math.abs(share - pillar.targetShare) > MIX_DRIFT_THRESHOLD,
    }
  })
}

const NEXT_WEEK_DAYS = 7

/** Vrai si rien n'est planifié sur les 7 prochains jours (filet anti-trou). */
export function nextWeekIsEmpty(dated: ContentItem[], tz: string): boolean {
  const today = dayKeyOf(MOCK_NOW.toISOString(), tz)
  const horizon = new Date(MOCK_NOW.getTime() + NEXT_WEEK_DAYS * DAY_MS)
  const horizonKey = dayKeyOf(horizon.toISOString(), tz)
  return !dated.some((it) => {
    if (!CADENCE_STATUSES.includes(it.status) || !it.scheduledAt) return false
    const key = dayKeyOf(it.scheduledAt, tz)
    return key > today && key <= horizonKey
  })
}
