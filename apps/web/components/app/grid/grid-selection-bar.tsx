"use client"

import { Ban, CalendarRange, Send } from "lucide-react"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"

// Actions par lot sur les tuiles planifiées sélectionnées (batch mensuel).
export function GridSelectionBar({
  selectedIds,
  onClear,
  onSendReview,
  onShiftWeek,
  onCancel,
}: {
  selectedIds: string[]
  onClear: () => void
  onSendReview: (ids: string[]) => void
  onShiftWeek: (ids: string[]) => void
  onCancel: (ids: string[]) => void
}) {
  function run(action: (ids: string[]) => void) {
    action(selectedIds)
    onClear()
  }

  return (
    <SelectionBar count={selectedIds.length} onClear={onClear} itemLabel="sélectionné">
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => run(onSendReview)}>
        <Send />
        Envoyer en validation
      </Button>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => run(onShiftWeek)}>
        <CalendarRange />
        Décaler d'une semaine
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => run(onCancel)}
      >
        <Ban />
        Annuler la planification
      </Button>
    </SelectionBar>
  )
}
