import type { MessageKey } from "@/lib/i18n"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { ContentItem, ContentStatus } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { zonedWallToUtcIso } from "@/lib/tz"
import type { DayKey } from "./calendar-utils"

// Replanification mockée : conversion clé jour + heure locale client → ISO UTC,
// et règles d'éditabilité par statut (PRD §5.B).

/** Statuts dont la date est verrouillée (pas de drag, pas de décalage). */
const LOCKED_STATUSES: ContentStatus[] = [
  "publishing",
  "published",
  "partially_published",
  "failed",
  "canceled",
]

export function isMovable(item: ContentItem): boolean {
  return !LOCKED_STATUSES.includes(item.status)
}

/** Clé i18n expliquant pourquoi la date est verrouillée (null si déplaçable). */
export function lockReasonKey(status: ContentStatus): MessageKey | null {
  if (!LOCKED_STATUSES.includes(status)) return null
  switch (status) {
    case "published":
      return "calendar.lock.published"
    case "publishing":
      return "calendar.lock.publishing"
    case "partially_published":
      return "calendar.lock.partiallyPublished"
    case "failed":
      return "calendar.lock.failed"
    default:
      return "calendar.lock.canceled"
  }
}

/** Instant UTC correspondant à `dayKey` + `time` (HH:mm) murale dans `tz`. */
export function zonedToUtcIso(dayKey: DayKey, time: string, tz: string): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return zonedWallToUtcIso(year, month, day, hour, minute, tz)
}

/** Heure murale "HH:mm" d'un ISO dans le fuseau du client. */
export function wallTimeOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace("h", ":")
}

// Fenêtre de création PRD §5.D : prochaine heure pleine entre 9 h et 21 h.
const CREATE_WINDOW_START_H = 9
const CREATE_WINDOW_END_H = 21

/** Heure par défaut d'un nouveau contenu (prochaine heure pleine, 9 h–21 h). */
export function defaultCreationTime(tz: string): string {
  const nowWall = wallTimeOf(MOCK_NOW.toISOString(), tz)
  const nextHour = Number(nowWall.slice(0, 2)) + 1
  const clamped = Math.min(Math.max(nextHour, CREATE_WINDOW_START_H), CREATE_WINDOW_END_H)
  return `${String(clamped).padStart(2, "0")}:00`
}

/**
 * Nouvel ISO d'un contenu déplacé vers `dayKey` : conserve son heure murale
 * (fuseau client), ou prend l'heure par défaut s'il n'était pas daté.
 */
export function movedIso(item: ContentItem, dayKey: DayKey, tz: string): string {
  const time = item.scheduledAt ? wallTimeOf(item.scheduledAt, tz) : defaultCreationTime(tz)
  return zonedToUtcIso(dayKey, time, tz)
}

/** Lien de création préremplie (route du studio créée par l'agent Composer). */
export function createContentHref(clientId: string, dayKey: DayKey, tz: string): string {
  return `${routes.contentNew(clientId)}?date=${dayKey}&time=${defaultCreationTime(tz)}`
}
