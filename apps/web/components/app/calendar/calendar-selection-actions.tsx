"use client"

import { useState } from "react"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"
import type { UseMultiSelectResult } from "@/hooks/use-multi-select"
import type { ContentItem } from "@/lib/mocks/types"
import { performSendToReview, performShift, performUnschedule } from "./calendar-actions"
import { isMovable } from "./calendar-schedule"
import type { DayKey } from "./calendar-utils"
import { ShiftDialog } from "./move-dialogs"

// Barre d'actions par lot du mode sélection : décaler de N jours, envoyer en
// validation, annuler la planification. Les statuts verrouillés sont ignorés.

export function CalendarSelectionActions({
  active,
  selection,
  selectedItems,
  todayKey,
  tz,
  setOverridesBatch,
}: {
  active: boolean
  selection: UseMultiSelectResult
  selectedItems: ContentItem[]
  todayKey: DayKey
  tz: string
  setOverridesBatch: (entries: [string, string | null][]) => void
}) {
  const [shiftOpen, setShiftOpen] = useState(false)
  const movableSelected = selectedItems.filter((it) => isMovable(it) && it.scheduledAt !== null)

  return (
    <>
      {active ? (
        <SelectionBar count={selection.count} onClear={selection.clear}>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => setShiftOpen(true)}
          >
            Décaler de N jours
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              performSendToReview(selection.count)
              selection.clear()
            }}
          >
            Envoyer en validation
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              performUnschedule(selectedItems, setOverridesBatch)
              selection.clear()
            }}
          >
            Annuler la planification
          </Button>
        </SelectionBar>
      ) : null}

      <ShiftDialog
        open={shiftOpen}
        movableCount={movableSelected.length}
        lockedCount={selectedItems.length - movableSelected.length}
        onClose={() => setShiftOpen(false)}
        onConfirm={(days) => {
          performShift(selectedItems, days, todayKey, tz, setOverridesBatch)
          setShiftOpen(false)
          selection.clear()
        }}
      />
    </>
  )
}
