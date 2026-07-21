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
import type { ContentItem } from "@/lib/domain"
import { useT } from "@/lib/i18n"
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
  const t = useT()
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
          <DialogTitle>{t("calendar.reschedule.title")}</DialogTitle>
          <DialogDescription className="truncate">{item ? item.title : null}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">{t("calendar.reschedule.date")}</Label>
            <Input
              id="reschedule-date"
              type="date"
              min={todayKey}
              value={dayKey}
              onChange={(e) => setDayKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time">{t("calendar.reschedule.time")}</Label>
            <Input
              id="reschedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        {invalid ? (
          <p className="text-xs text-destructive">{t("calendar.reschedule.pastError")}</p>
        ) : null}
        {item?.status === "approved" ? (
          <p className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2 text-xs text-warning">
            {t("calendar.reschedule.approvedNote")}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={invalid || !item} onClick={() => item && onConfirm(item, dayKey, time)}>
            {t("calendar.reschedule.confirm")}
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
  const t = useT()
  const [days, setDays] = useState(DEFAULT_SHIFT_DAYS)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("calendar.shift.title")}</DialogTitle>
          <DialogDescription>
            {t("calendar.shift.description", { movable: movableCount, locked: lockedCount })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="shift-days">{t("calendar.shift.daysLabel")}</Label>
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
            {t("common.cancel")}
          </Button>
          <Button disabled={days === 0 || movableCount === 0} onClick={() => onConfirm(days)}>
            {t("calendar.shift.confirm", { days: Math.abs(days) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
