"use client"

import { CalendarClock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { days, fromNow, hours } from "@/lib/clock"
import type { Client } from "@/lib/domain"
import { type MessageKey, useFormat, useT } from "@/lib/i18n"
import { wallClockIn, zonedToUtcIso } from "./composer/composer-utils"

// Programmation en série (lot) : date/heure de départ dans le fuseau du
// client + espacement échelonné. Mutation locale visible (aperçu).

const GAPS: { value: string; labelKey: MessageKey }[] = [
  { value: "0", labelKey: "studio.scheduleDialog.gapHourly" },
  { value: "1", labelKey: "studio.scheduleDialog.gapDaily" },
  { value: "2", labelKey: "studio.scheduleDialog.gap2Days" },
  { value: "7", labelKey: "studio.scheduleDialog.gapWeekly" },
]

const pad = (n: number) => String(n).padStart(2, "0")

export function BoardScheduleDialog({
  open,
  onOpenChange,
  count,
  client,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  client: Client
  onConfirm: (startIso: string, gapDays: number) => void
}) {
  const t = useT()
  const f = useFormat()
  const tz = client.timezone
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [gap, setGap] = useState("1")

  // Défaut à l'ouverture : demain 9 h dans le fuseau du client.
  useEffect(() => {
    if (!open) return
    const wc = wallClockIn(fromNow(days(1)), tz)
    setDate(`${wc.year}-${pad(wc.month)}-${pad(wc.day)}`)
    setTime("09:00")
    setGap("1")
  }, [open, tz])

  const startIso = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number)
    const [h, min] = time.split(":").map(Number)
    if (!y || !m || !d || !Number.isFinite(h) || !Number.isFinite(min)) return null
    return zonedToUtcIso(y, m, d, h, min, tz)
  }, [date, time, tz])

  const gapDays = Number(gap)
  const endIso =
    startIso && count > 1
      ? new Date(
          new Date(startIso).getTime() + (count - 1) * (gapDays === 0 ? hours(1) : days(gapDays))
        ).toISOString()
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("studio.scheduleDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("studio.scheduleDialog.description", { count, tz })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="board-schedule-date">{t("studio.scheduleDialog.firstSlot")}</Label>
              <Input
                id="board-schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="board-schedule-time">
                {t("studio.scheduleDialog.timeLabel", { tz })}
              </Label>
              <Input
                id="board-schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="board-schedule-gap">{t("studio.scheduleDialog.spacing")}</Label>
            <Select value={gap} onValueChange={(v) => setGap(String(v))}>
              <SelectTrigger id="board-schedule-gap" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAPS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {t(g.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {startIso ? (
            <p className="rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground tabular-nums">
              <strong className="text-foreground">
                {t("studio.scheduleDialog.rangeFrom", { start: f.dateTime(startIso, tz) })}
              </strong>
              {endIso ? (
                <strong className="text-foreground">
                  {t("studio.scheduleDialog.rangeTo", { end: f.dateTime(endIso, tz) })}
                </strong>
              ) : null}
              {t("studio.scheduleDialog.rangeSuffix")}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={startIso === null}
            onClick={() => startIso && onConfirm(startIso, gapDays)}
          >
            <CalendarClock />
            {t("studio.scheduleDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
