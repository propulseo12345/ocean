import { toast } from "sonner"
import type { Locale, Translator } from "@/lib/i18n"
import { pick } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { isMovable, movedIso, zonedToUtcIso } from "./calendar-schedule"
import { type DayKey, dayKeyOf, shiftWeek, weekdayDayMonth } from "./calendar-utils"

// Actions mockées du calendrier : chaque opération applique un override local
// et l'annonce par un toast « (aperçu) ». Aucune donnée réelle n'est modifiée.
// Le libellé de date provient de weekdayDayMonth (util calendrier partagé).

type SetOverride = (id: string, iso: string | null) => void
type SetOverridesBatch = (entries: [string, string | null][]) => void

/** Drop d'une carte sur une case : règles passé/verrou/approbation. */
export function performDrop(
  item: ContentItem,
  dayKey: DayKey,
  todayKey: DayKey,
  tz: string,
  setOverride: SetOverride,
  t: Translator,
  locale: Locale
): void {
  if (!isMovable(item)) return
  if (dayKey < todayKey) {
    toast.error(t("calendar.actions.pastError"))
    return
  }
  const wasUnscheduled = item.scheduledAt === null
  if (!wasUnscheduled && dayKeyOf(item.scheduledAt as string, tz) === dayKey) return

  setOverride(item.id, movedIso(item, dayKey, tz))
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
  locale: Locale
): void {
  setOverride(item.id, zonedToUtcIso(dayKey, time, tz))
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
  t: Translator
): void {
  const entries: [string, string][] = []
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
  }
  if (entries.length > 0) setBatch(entries)
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
  t: Translator
): void {
  const movable = items.filter((it) => isMovable(it) && it.scheduledAt !== null)
  const skipped = items.length - movable.length
  if (movable.length > 0) setBatch(movable.map((it) => [it.id, null]))
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

export function performRetry(item: ContentItem, t: Translator, locale: Locale): void {
  toast.info(t("calendar.actions.retry", { title: pick(item.title, locale) }), {
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
  toast.success(t("calendar.actions.duplicated", { title: pick(item.title, locale) }), {
    description: t("calendar.actions.duplicatedDesc", {
      date: weekdayDayMonth(dayKey, tz, locale),
      client: targetClientName ?? "none",
    }),
  })
}
