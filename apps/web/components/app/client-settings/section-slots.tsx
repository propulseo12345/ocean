"use client"

import { CalendarClock, Info, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Client, ContentPillar, RecurringSlot } from "@/lib/mocks/types"
import { SectionCard } from "./section-card"
import { SlotRow } from "./slot-row"
import { SlotsWeekPreview } from "./slots-week-preview"

let counter = 0

export function SectionSlots({
  client,
  slots: initial,
  pillars,
}: {
  client: Client
  slots: RecurringSlot[]
  pillars: ContentPillar[]
}) {
  const [slots, setSlots] = useState<RecurringSlot[]>(initial)

  function patch(id: string, patch: Partial<RecurringSlot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function remove(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id))
    toast.info("Créneau supprimé (aperçu)")
  }

  function add() {
    counter += 1
    const slot: RecurringSlot = {
      id: `slot_new_${counter}`,
      clientId: client.id,
      weekday: 2,
      time: "11:30",
      platforms: ["instagram"],
    }
    setSlots((prev) => [...prev, slot])
    toast.info("Créneau ajouté (aperçu)", {
      description: "Ajuste le jour, l'heure et les réseaux.",
    })
  }

  return (
    <SectionCard
      icon={CalendarClock}
      title="Créneaux de publication récurrents"
      description="Les rendez-vous hebdomadaires convenus avec le client."
      action={
        <Button size="sm" variant="outline" onClick={add}>
          <Plus />
          Ajouter
        </Button>
      }
    >
      {slots.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun créneau défini. Ajoute les rendez-vous récurrents pour préremplir le batch mensuel.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jour</TableHead>
              <TableHead>Heure</TableHead>
              <TableHead>Réseaux</TableHead>
              <TableHead>Pilier</TableHead>
              <TableHead className="text-right">Retirer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                pillars={pillars}
                onPatch={(p) => patch(slot.id, p)}
                onRemove={() => remove(slot.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Ces créneaux préremplissent les dates suggérées dans le studio et matérialisent les trous à
        combler dans le calendrier.
      </p>

      {slots.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Aperçu de la semaine type</p>
          <SlotsWeekPreview slots={slots} />
        </div>
      ) : null}
    </SectionCard>
  )
}
