"use client"

import { PlatformIcons } from "@/components/shared/platform-badge"
import { useT } from "@/lib/i18n"
import type { ContentPillar, RecurringSlot } from "@/lib/mocks/types"
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "./constants"

// Aperçu hebdomadaire des créneaux récurrents : grille 7 jours, chaque créneau
// positionné sous son jour, trié par heure. Donne à voir la cadence convenue.
//
// La couleur du pilier vient des piliers DÉJÀ chargés et scopés par la RLS (pas
// d'une map globale tous-clients : celle-ci serait un lookup cross-tenant côté
// client une fois les données réelles branchées).

export function SlotsWeekPreview({
  slots,
  pillars,
}: {
  slots: RecurringSlot[]
  pillars: ContentPillar[]
}) {
  const t = useT()
  const pillarColor = new Map(pillars.map((p) => [p.id, p.colorVar]))
  const byDay = new Map<number, RecurringSlot[]>()
  for (const slot of slots) {
    const list = byDay.get(slot.weekday) ?? []
    list.push(slot)
    byDay.set(slot.weekday, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time))
  }

  return (
    <div className="grid grid-cols-7 gap-1 overflow-x-auto">
      {WEEKDAY_ORDER.map((day) => {
        const daySlots = byDay.get(day) ?? []
        return (
          <div key={day} className="min-w-12 rounded-lg border bg-muted/30 p-1">
            <p className="mb-1 text-center text-[11px] font-medium text-muted-foreground">
              {t(WEEKDAY_LABELS[day].shortKey)}
            </p>
            <div className="space-y-1">
              {daySlots.map((slot) => {
                const colorVar = slot.pillarId ? pillarColor.get(slot.pillarId) : undefined
                return (
                  <div
                    key={slot.id}
                    className="rounded-md border-l-2 bg-card px-1 py-1 text-[10px] leading-tight"
                    style={{ borderLeftColor: colorVar ?? "var(--border)" }}
                  >
                    <span className="block font-medium tabular-nums">{slot.time}</span>
                    <PlatformIcons platforms={slot.platforms} className="mt-0.5 gap-0.5" />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
