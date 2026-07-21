"use client"

import { CalendarClock, CircleAlert, Zap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { enUS, fr } from "react-day-picker/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { now as clockNow } from "@/lib/clock"
import type { Client, RecurringSlot } from "@/lib/domain"
import { useFormat, useLocale, useT } from "@/lib/i18n"
import {
  ASAP_DELAY_MS,
  GRACE_WINDOW_HOURS,
  MIN_LEAD_MS,
  scheduleShortcuts,
  wallClockIn,
  zonedToUtcIso,
} from "./composer-utils"

// Programmation outillée : date + heure dans le fuseau DU CLIENT, raccourcis
// (demain 9 h, samedi 11 h, prochain créneau récurrent) et règle de rattrapage
// si la date est passée (fenêtre de grâce 2 h — décision actée n°12).

type LateChoice = "asap" | "repick"

const pad = (n: number) => String(n).padStart(2, "0")
const PREVIEW_OWNER_TIMEZONE = "Europe/Paris"

export function ScheduleDialog({
  open,
  onOpenChange,
  client,
  slots,
  scheduledAt,
  blockingCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  slots: RecurringSlot[]
  scheduledAt: string | null
  /** Erreurs pré-flight (hors date) : bloquent la confirmation. */
  blockingCount: number
  onConfirm: (iso: string | null) => void
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const tz = client.timezone
  const current = useMemo(() => clockNow(), [])
  const shortcuts = useMemo(() => scheduleShortcuts(client, slots), [client, slots])

  const [day, setDay] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState("09:00")
  const [lateChoice, setLateChoice] = useState<LateChoice>("asap")

  // Réinitialisation à l'ouverture : date existante, sinon demain 9 h.
  useEffect(() => {
    if (!open) return
    const source = scheduledAt ?? shortcuts[0]?.iso
    if (!source) return
    const wc = wallClockIn(source, tz)
    setDay(new Date(wc.year, wc.month - 1, wc.day))
    setTime(`${pad(wc.hour)}:${pad(wc.minute)}`)
    setLateChoice("asap")
  }, [open, scheduledAt, tz, shortcuts])

  const [hour, minute] = time.split(":").map(Number)
  const iso =
    day && Number.isFinite(hour) && Number.isFinite(minute)
      ? zonedToUtcIso(day.getFullYear(), day.getMonth() + 1, day.getDate(), hour, minute, tz)
      : null
  const isLate = iso !== null && new Date(iso).getTime() < current.getTime() + MIN_LEAD_MS
  const blocked = blockingCount > 0
  const confirmDisabled = blocked || iso === null || (isLate && lateChoice === "repick")

  function applyShortcut(shortcutIso: string) {
    const wc = wallClockIn(shortcutIso, tz)
    setDay(new Date(wc.year, wc.month - 1, wc.day))
    setTime(`${pad(wc.hour)}:${pad(wc.minute)}`)
  }

  function confirm() {
    if (iso === null) return
    const finalIso = isLate ? new Date(current.getTime() + ASAP_DELAY_MS).toISOString() : iso
    onConfirm(finalIso)
    onOpenChange(false)
    toast.success(
      isLate ? t("composer.schedule.toastAsap") : t("composer.schedule.toastScheduled"),
      {
        description: t("composer.schedule.toastScheduledDesc", {
          date: f.dateTime(finalIso, tz),
          tz,
        }),
      }
    )
  }

  function removeDate() {
    onConfirm(null)
    onOpenChange(false)
    toast.info(t("composer.schedule.toastRemoved"), {
      description: t("composer.schedule.toastRemovedDesc"),
    })
  }

  const nowWc = wallClockIn(current, tz)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("composer.schedule.title")}</DialogTitle>
          <DialogDescription>{t("composer.schedule.tzNote", { tz })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((s) => (
              <Button key={s.id} variant="outline" size="xs" onClick={() => applyShortcut(s.iso)}>
                <CalendarClock />
                {t(s.labelKey, s.labelParams)}
              </Button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              defaultMonth={day ?? new Date(nowWc.year, nowWc.month - 1, nowWc.day)}
              locale={locale === "fr" ? fr : enUS}
              className="rounded-lg border"
            />
            <div className="w-full space-y-1.5 sm:w-36">
              <Label htmlFor="composer-time">{t("composer.schedule.hour", { tz })}</Label>
              <Input
                id="composer-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          {iso !== null && !isLate ? (
            <div className="space-y-0.5 rounded-lg border bg-muted/40 p-2.5 text-sm">
              <p className="font-medium tabular-nums">
                {t("composer.schedule.publishAt", { date: f.dateTime(iso, tz) })}{" "}
                <span className="font-normal text-muted-foreground">
                  {t("composer.schedule.tzClient")}
                </span>
              </p>
              {PREVIEW_OWNER_TIMEZONE !== tz ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("composer.schedule.inYourTz", {
                    date: f.dateTime(iso, PREVIEW_OWNER_TIMEZONE),
                    tz: PREVIEW_OWNER_TIMEZONE,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {isLate ? (
            <div className="space-y-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm font-medium text-warning">{t("composer.schedule.latePast")}</p>
              <RadioGroup
                value={lateChoice}
                onValueChange={(v) => setLateChoice(v as LateChoice)}
                className="gap-2.5"
              >
                <Label className="flex items-start gap-2 font-normal">
                  <RadioGroupItem value="asap" className="mt-0.5" />
                  <span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Zap className="size-3.5" />
                      {t("composer.schedule.asap")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("composer.schedule.asapDetail", { hours: GRACE_WINDOW_HOURS })}
                    </span>
                  </span>
                </Label>
                <Label className="flex items-start gap-2 font-normal">
                  <RadioGroupItem value="repick" className="mt-0.5" />
                  <span>
                    <span className="font-medium">{t("composer.schedule.repick")}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("composer.schedule.repickDetail")}
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
          ) : null}

          {blocked ? (
            <p className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs font-medium text-destructive">
              <CircleAlert className="mt-px size-3.5 shrink-0" />
              {t("composer.schedule.blocked", { count: blockingCount })}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {scheduledAt ? (
            <Button variant="destructive" onClick={removeDate} className="sm:mr-auto">
              {t("composer.schedule.removeDate")}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm} disabled={confirmDisabled}>
            <CalendarClock />
            {t("composer.schedule.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
