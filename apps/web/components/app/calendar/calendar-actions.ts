import { toast } from "sonner"
import type { ContentItem } from "@/lib/mocks/types"
import { isMovable, movedIso, zonedToUtcIso } from "./calendar-schedule"
import { type DayKey, dayKeyOf, shiftWeek, weekdayDayMonth } from "./calendar-utils"

// Actions mockées du calendrier : chaque opération applique un override local
// et l'annonce par un toast « (aperçu) ». Aucune donnée réelle n'est modifiée.

type SetOverride = (id: string, iso: string | null) => void
type SetOverridesBatch = (entries: [string, string | null][]) => void

/** Drop d'une carte sur une case : règles passé/verrou/approbation. */
export function performDrop(
  item: ContentItem,
  dayKey: DayKey,
  todayKey: DayKey,
  tz: string,
  setOverride: SetOverride
): void {
  if (!isMovable(item)) return
  if (dayKey < todayKey) {
    toast.error("Impossible de planifier dans le passé")
    return
  }
  const wasUnscheduled = item.scheduledAt === null
  if (!wasUnscheduled && dayKeyOf(item.scheduledAt as string, tz) === dayKey) return

  setOverride(item.id, movedIso(item, dayKey, tz))
  const label = weekdayDayMonth(dayKey, tz)
  if (item.status === "approved") {
    toast.warning(`Replanifié au ${label} (aperçu)`, {
      description:
        "La validation client reste valable — le client sera notifié du changement de date.",
    })
  } else {
    toast.success(`${wasUnscheduled ? "Planifié" : "Replanifié"} au ${label} (aperçu)`, {
      description: "Aucune date n'est réellement modifiée pendant la preview.",
    })
  }
}

/** Replanification précise depuis le dialog (date + heure). */
export function performReschedule(
  item: ContentItem,
  dayKey: DayKey,
  time: string,
  tz: string,
  setOverride: SetOverride
): void {
  setOverride(item.id, zonedToUtcIso(dayKey, time, tz))
  toast.success(`Replanifié au ${weekdayDayMonth(dayKey, tz)} à ${time} (aperçu)`, {
    description:
      item.status === "approved"
        ? "La validation client reste valable — le client sera notifié."
        : undefined,
  })
}

/** Décalage de N jours d'une sélection (les verrouillés sont ignorés). */
export function performShift(
  items: ContentItem[],
  days: number,
  todayKey: DayKey,
  tz: string,
  setBatch: SetOverridesBatch
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
  const dir = days > 0 ? "décalé" : "avancé"
  toast.success(
    `${entries.length} contenu${entries.length > 1 ? "s" : ""} ${dir}${entries.length > 1 ? "s" : ""} de ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""} (aperçu)`,
    {
      description:
        skipped > 0
          ? `${skipped} ignoré${skipped > 1 ? "s" : ""} (statut verrouillé ou date passée).`
          : undefined,
    }
  )
}

/** Annulation de planification d'une sélection (retour à l'étagère). */
export function performUnschedule(items: ContentItem[], setBatch: SetOverridesBatch): void {
  const movable = items.filter((it) => isMovable(it) && it.scheduledAt !== null)
  const skipped = items.length - movable.length
  if (movable.length > 0) setBatch(movable.map((it) => [it.id, null]))
  toast.success(
    `Planification annulée pour ${movable.length} contenu${movable.length > 1 ? "s" : ""} (aperçu)`,
    {
      description:
        skipped > 0
          ? `${skipped} ignoré${skipped > 1 ? "s" : ""} (statut verrouillé ou déjà sans date). Les contenus repassent dans « À planifier ».`
          : "Les contenus repassent dans « À planifier ».",
    }
  )
}

export function performSendToReview(count: number): void {
  toast.info(
    `Demande de validation envoyée pour ${count} contenu${count > 1 ? "s" : ""} (aperçu)`,
    {
      description: "Le client recevra un lien direct vers le portail de validation.",
    }
  )
}

export function performRetry(item: ContentItem): void {
  toast.info(`Nouvelle tentative programmée pour « ${item.title} » (aperçu)`, {
    description:
      "Seules les cibles en échec seront relancées — jamais de re-publication d'une cible déjà publiée.",
  })
}

export function performRemind(reviewerName: string | null): void {
  toast.info(`Relance envoyée à ${reviewerName ?? "ton client"} (aperçu)`, {
    description: "Un rappel email pointe directement vers les contenus à valider.",
  })
}

export function performDuplicate(
  item: ContentItem,
  dayKey: DayKey,
  tz: string,
  targetClientName: string | null
): void {
  toast.success(`« ${item.title} » dupliqué (aperçu)`, {
    description: `Copie en brouillon pour le ${weekdayDayMonth(dayKey, tz)}${
      targetClientName ? ` chez ${targetClientName}` : ""
    } — médias, légende et ciblage repris.`,
  })
}
