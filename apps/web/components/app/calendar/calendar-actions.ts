import { toast } from "sonner"
import { scheduleContentItem } from "@/lib/actions/content"
import type { Locale, Translator } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { isMovable, movedIso, zonedToUtcIso } from "./calendar-schedule"
import { type DayKey, dayKeyOf, shiftWeek, weekdayDayMonth } from "./calendar-utils"

// Actions du calendrier : chaque opération applique un override local (UX
// optimiste) puis PERSISTE la nouvelle date via scheduleContentItem, avec
// rollback de l'override si l'écriture échoue. Le déplacement ne touche QUE la
// date (jamais le statut : la garde 008/016 régit les statuts, isMovable régit
// quels contenus sont déplaçables). Libellé de date = weekdayDayMonth.

type SetOverride = (id: string, iso: string | null) => void
type SetOverridesBatch = (entries: [string, string | null][]) => void

/**
 * Persiste une (re)planification unitaire et ROLLBACK vers `previousIso` si
 * l'écriture échoue. Fire-and-forget : le toast et l'override sont déjà posés.
 */
function persistOne(
  clientId: string,
  id: string,
  iso: string | null,
  previousIso: string | null,
  setOverride: SetOverride,
  t: Translator
): void {
  scheduleContentItem({ clientId, contentId: id, scheduledAt: iso }).then((res) => {
    if (!res.ok) {
      setOverride(id, previousIso)
      toast.error(t("calendar.actions.persistError"))
    }
  })
}

/**
 * Persiste un lot de (re)planifications. Un seul toast d'erreur pour le lot ;
 * seuls les items en échec sont remis à leur date d'origine (`prev` par id).
 */
function persistBatch(
  clientId: string,
  entries: [string, string | null][],
  prev: Map<string, string | null>,
  setBatch: SetOverridesBatch,
  t: Translator
): void {
  Promise.all(
    entries.map(([id, iso]) =>
      scheduleContentItem({ clientId, contentId: id, scheduledAt: iso }).then((res) => ({
        id,
        ok: res.ok,
      }))
    )
  ).then((results) => {
    const failed = results.filter((r) => !r.ok).map((r) => r.id)
    if (failed.length > 0) {
      setBatch(failed.map((id) => [id, prev.get(id) ?? null]))
      toast.error(t("calendar.actions.persistError"))
    }
  })
}

/** Drop d'une carte sur une case : règles passé/verrou/approbation. */
export function performDrop(
  item: ContentItem,
  dayKey: DayKey,
  todayKey: DayKey,
  tz: string,
  setOverride: SetOverride,
  t: Translator,
  locale: Locale,
  clientId: string
): void {
  if (!isMovable(item)) return
  if (dayKey < todayKey) {
    toast.error(t("calendar.actions.pastError"))
    return
  }
  const wasUnscheduled = item.scheduledAt === null
  if (!wasUnscheduled && dayKeyOf(item.scheduledAt as string, tz) === dayKey) return

  const newIso = movedIso(item, dayKey, tz)
  setOverride(item.id, newIso)
  persistOne(clientId, item.id, newIso, item.scheduledAt, setOverride, t)
  const label = weekdayDayMonth(dayKey, tz, locale)
  if (item.status === "approved") {
    toast.warning(t("calendar.actions.rescheduledApproved", { date: label }), {
      description: t("calendar.actions.rescheduledApprovedDesc"),
    })
  } else {
    toast.success(
      t("calendar.actions.moved", {
        date: label,
        state: wasUnscheduled ? "scheduled" : "rescheduled",
      }),
      {
        description: t("calendar.actions.movedDesc"),
      }
    )
  }
}

/** Replanification précise depuis le dialog (date + heure). */
export function performReschedule(
  item: ContentItem,
  dayKey: DayKey,
  time: string,
  tz: string,
  setOverride: SetOverride,
  t: Translator,
  locale: Locale,
  clientId: string
): void {
  const newIso = zonedToUtcIso(dayKey, time, tz)
  setOverride(item.id, newIso)
  persistOne(clientId, item.id, newIso, item.scheduledAt, setOverride, t)
  toast.success(
    t("calendar.actions.reschedulePrecise", { date: weekdayDayMonth(dayKey, tz, locale), time }),
    {
      description:
        item.status === "approved"
          ? t("calendar.actions.reschedulePreciseApprovedDesc")
          : undefined,
    }
  )
}

/** Décalage de N jours d'une sélection (les verrouillés sont ignorés). */
export function performShift(
  items: ContentItem[],
  days: number,
  todayKey: DayKey,
  tz: string,
  setBatch: SetOverridesBatch,
  t: Translator,
  clientId: string
): void {
  const entries: [string, string | null][] = []
  const prev = new Map<string, string | null>()
  let skipped = 0
  for (const item of items) {
    if (!isMovable(item) || !item.scheduledAt) {
      skipped++
      continue
    }
    // Décalage par clé jour (fuseau client) puis ré-ancrage de l'heure murale :
    // un post à 09:00 reste à 09:00 même par-dessus une bascule heure d'été/hiver
    // (ajouter days × 24 h en UTC glisserait de ±1 h).
    const targetKey = shiftWeek(dayKeyOf(item.scheduledAt, tz), days)
    if (targetKey < todayKey) {
      skipped++
      continue
    }
    entries.push([item.id, movedIso(item, targetKey, tz)])
    prev.set(item.id, item.scheduledAt)
  }
  if (entries.length > 0) {
    setBatch(entries)
    persistBatch(clientId, entries, prev, setBatch, t)
  }
  toast.success(
    t("calendar.actions.shifted", {
      count: entries.length,
      dir: days > 0 ? "shift" : "advance",
      days: Math.abs(days),
    }),
    {
      description:
        skipped > 0 ? t("calendar.actions.shiftedSkippedDesc", { count: skipped }) : undefined,
    }
  )
}

/** Annulation de planification d'une sélection (retour à l'étagère). */
export function performUnschedule(
  items: ContentItem[],
  setBatch: SetOverridesBatch,
  t: Translator,
  clientId: string
): void {
  const movable = items.filter((it) => isMovable(it) && it.scheduledAt !== null)
  const skipped = items.length - movable.length
  if (movable.length > 0) {
    const entries: [string, string | null][] = movable.map((it) => [it.id, null])
    const prev = new Map<string, string | null>(movable.map((it) => [it.id, it.scheduledAt]))
    setBatch(entries)
    persistBatch(clientId, entries, prev, setBatch, t)
  }
  toast.success(t("calendar.actions.unscheduled", { count: movable.length }), {
    description:
      skipped > 0
        ? t("calendar.actions.unscheduledSkippedDesc", { count: skipped })
        : t("calendar.actions.unscheduledDesc"),
  })
}

export function performSendToReview(count: number, t: Translator): void {
  toast.info(t("calendar.actions.sendToReview", { count }), {
    description: t("calendar.actions.sendToReviewDesc"),
  })
}

export function performRetry(item: ContentItem, t: Translator, _locale: Locale): void {
  toast.info(t("calendar.actions.retry", { title: item.title }), {
    description: t("calendar.actions.retryDesc"),
  })
}

export function performRemind(reviewerName: string | null, t: Translator): void {
  toast.info(
    t("calendar.actions.remind", {
      name: reviewerName ?? t("calendar.actions.remindFallbackName"),
    }),
    {
      description: t("calendar.actions.remindDesc"),
    }
  )
}

export function performDuplicate(
  item: ContentItem,
  dayKey: DayKey,
  tz: string,
  targetClientName: string | null,
  t: Translator,
  locale: Locale
): void {
  toast.success(t("calendar.actions.duplicated", { title: item.title }), {
    description: t("calendar.actions.duplicatedDesc", {
      date: weekdayDayMonth(dayKey, tz, locale),
      client: targetClientName ?? "none",
    }),
  })
}
