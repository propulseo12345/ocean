import type { MessageKey, MessageParams } from "@/lib/i18n"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { Client, Platform, RecurringSlot, SocialAccount } from "@/lib/mocks/types"
import { zonedWallToUtcIso } from "@/lib/tz"
import type { ComposerDraft } from "./composer-types"

// Helpers purs du composer : fuseaux, raccourcis de programmation, ciblage.
// Tout est calculé depuis MOCK_NOW (11/06/2026) — aucune horloge réelle.

/** Garde-fou PRD §5.B : programmation ≥ maintenant + 15 min. */
export const MIN_LEAD_MS = 15 * 60_000
/** Fenêtre de grâce du worker : rattrapage si < 2 h de retard (décision n°12). */
export const GRACE_WINDOW_HOURS = 2
/** Délai simulé du « publier dès que possible » (rattrapage). */
export const ASAP_DELAY_MS = 5 * 60_000

const ISO_SATURDAY = 6
const DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// Fuseaux horaires (primitive partagée dans @/lib/tz)

/** Instant UTC (ISO) correspondant à une date/heure murale dans un fuseau. */
export function zonedToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  return zonedWallToUtcIso(year, month, day, hour, minute, timeZone)
}

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  isoWeekday: number
}

/** Décompose un instant en date/heure murale d'un fuseau. */
export function wallClockIn(iso: string | Date, timeZone: string): WallClock {
  const date = typeof iso === "string" ? new Date(iso) : iso
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  const year = get("year")
  const month = get("month")
  const day = get("day")
  const utcDow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return {
    year,
    month,
    day,
    hour: get("hour") % 24,
    minute: get("minute"),
    isoWeekday: utcDow === 0 ? 7 : utcDow,
  }
}

/** Décale une date calendaire de n jours (normalisation via UTC). */
function shiftDay(wc: WallClock, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(wc.year, wc.month - 1, wc.day) + days * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

// ---------------------------------------------------------------------------
// Raccourcis de programmation

export interface ScheduleShortcut {
  id: string
  /** Clé i18n du libellé, résolue à l'affichage via t(). */
  labelKey: MessageKey
  /** Paramètres d'interpolation du libellé (ex. heure du créneau récurrent). */
  labelParams?: MessageParams
  iso: string
}

/** Prochaine occurrence d'un créneau récurrent (heure murale du client). */
function nextSlotIso(slot: RecurringSlot, timeZone: string): string {
  const now = wallClockIn(MOCK_NOW, timeZone)
  const [hour, minute] = slot.time.split(":").map(Number)
  let delta = (slot.weekday - now.isoWeekday + 7) % 7
  if (delta === 0) {
    const candidate = zonedToUtcIso(now.year, now.month, now.day, hour, minute, timeZone)
    if (new Date(candidate).getTime() < MOCK_NOW.getTime() + MIN_LEAD_MS) delta = 7
  }
  const target = shiftDay(now, delta)
  return zonedToUtcIso(target.year, target.month, target.day, hour, minute, timeZone)
}

export function scheduleShortcuts(client: Client, slots: RecurringSlot[]): ScheduleShortcut[] {
  const tz = client.timezone
  const now = wallClockIn(MOCK_NOW, tz)

  const tomorrow = shiftDay(now, 1)
  const out: ScheduleShortcut[] = [
    {
      id: "tomorrow",
      labelKey: "composer.schedule.shortcutTomorrow",
      iso: zonedToUtcIso(tomorrow.year, tomorrow.month, tomorrow.day, 9, 0, tz),
    },
  ]

  const toSaturday = (ISO_SATURDAY - now.isoWeekday + 7) % 7 || 7
  const saturday = shiftDay(now, toSaturday)
  out.push({
    id: "saturday",
    labelKey: "composer.schedule.shortcutSaturday",
    iso: zonedToUtcIso(saturday.year, saturday.month, saturday.day, 11, 0, tz),
  })

  if (slots.length > 0) {
    const next = slots
      .map((slot) => ({ slot, iso: nextSlotIso(slot, tz) }))
      .sort((a, b) => a.iso.localeCompare(b.iso))[0]
    out.push({
      id: "slot",
      labelKey: "composer.schedule.shortcutNextSlot",
      labelParams: { time: next.slot.time },
      iso: next.iso,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Ciblage et légendes effectives

const API_ORDER: Platform[] = ["instagram", "facebook", "tiktok"]

/** Plateformes API ciblées par le brouillon, dans un ordre stable. */
export function targetedApiPlatforms(draft: ComposerDraft, accounts: SocialAccount[]): Platform[] {
  const set = new Set<Platform>()
  for (const id of draft.accountIds) {
    const account = accounts.find((a) => a.id === id)
    if (account) set.add(account.platform)
  }
  return API_ORDER.filter((p) => set.has(p))
}

/** Légende effective pour une plateforme : déclinaison ou légende commune. */
export function effectiveCaption(draft: ComposerDraft, platform: Platform): string {
  return draft.captionOverrides[platform] ?? draft.caption
}

/** Insère un groupe de hashtags à la fin d'un texte (saut de ligne propre). */
export function appendHashtags(text: string, tags: string[]): string {
  const joined = tags.join(" ")
  if (text.trim().length === 0) return joined
  return `${text.trimEnd()}\n\n${joined}`
}
