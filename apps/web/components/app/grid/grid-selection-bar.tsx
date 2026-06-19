"use client"

import { Ban, CalendarRange, Send } from "lucide-react"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

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
  const t = useT()

  function run(action: (ids: string[]) => void) {
    action(selectedIds)
    onClear()
  }

  return (
    <SelectionBar
      count={selectedIds.length}
      onClear={onClear}
      itemLabel={t("grid.selectionBar.itemLabel")}
    >
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => run(onSendReview)}>
        <Send />
        {t("grid.selectionBar.sendReview")}
      </Button>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => run(onShiftWeek)}>
        <CalendarRange />
        {t("grid.selectionBar.shiftWeek")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => run(onCancel)}
      >
        <Ban />
        {t("grid.selectionBar.cancelSchedule")}
      </Button>
    </SelectionBar>
  )
}
