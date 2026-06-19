"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ContentItem } from "@/lib/mocks/types"
import { defaultCreationTime, wallTimeOf } from "./calendar-schedule"
import { type DayKey, dayKeyOf, shiftWeek } from "./calendar-utils"

// Dialogs de replanification : date précise (un contenu) et décalage de
// N jours (lot). Tout est simulé — les toasts le rappellent.

export function RescheduleDialog({
  item,
  tz,
  todayKey,
  onClose,
  onConfirm,
}: {
  item: ContentItem | null
  tz: string
  todayKey: DayKey
  onClose: () => void
  onConfirm: (item: ContentItem, dayKey: DayKey, time: string) => void
}) {
  const [dayKey, setDayKey] = useState<DayKey>(todayKey)
  const [time, setTime] = useState("11:00")

  useEffect(() => {
    if (!item) return
    const base = item.scheduledAt ? dayKeyOf(item.scheduledAt, tz) : shiftWeek(todayKey, 1)
    setDayKey(base < todayKey ? shiftWeek(todayKey, 1) : base)
    setTime(item.scheduledAt ? wallTimeOf(item.scheduledAt, tz) : defaultCreationTime(tz))
  }, [item, tz, todayKey])

  const invalid = dayKey < todayKey

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replanifier</DialogTitle>
          <DialogDescription className="truncate">{item?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">Date (fuseau client)</Label>
            <Input
              id="reschedule-date"
              type="date"
              min={todayKey}
              value={dayKey}
              onChange={(e) => setDayKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time">Heure</Label>
            <Input
              id="reschedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        {invalid ? (
          <p className="text-xs text-destructive">Impossible de replanifier dans le passé.</p>
        ) : null}
        {item?.status === "approved" ? (
          <p className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2 text-xs text-warning">
            La validation client reste valable après le changement de date — le client sera
            simplement notifié.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={invalid || !item} onClick={() => item && onConfirm(item, dayKey, time)}>
            Replanifier (aperçu)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const DEFAULT_SHIFT_DAYS = 7

export function ShiftDialog({
  open,
  movableCount,
  lockedCount,
  onClose,
  onConfirm,
}: {
  open: boolean
  movableCount: number
  lockedCount: number
  onClose: () => void
  onConfirm: (days: number) => void
}) {
  const [days, setDays] = useState(DEFAULT_SHIFT_DAYS)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Décaler la sélection</DialogTitle>
          <DialogDescription>
            {movableCount} contenu{movableCount > 1 ? "s" : ""} sera
            {movableCount > 1 ? "ont" : ""} décalé{movableCount > 1 ? "s" : ""}
            {lockedCount > 0
              ? ` · ${lockedCount} ignoré${lockedCount > 1 ? "s" : ""} (statut verrouillé)`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="shift-days">Nombre de jours (négatif = avancer)</Label>
          <Input
            id="shift-days"
            type="number"
            min={-30}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={days === 0 || movableCount === 0} onClick={() => onConfirm(days)}>
            Décaler de {days} jour{Math.abs(days) > 1 ? "s" : ""} (aperçu)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
