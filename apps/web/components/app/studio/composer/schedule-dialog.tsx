"use client"

import { CalendarClock, CircleAlert, Zap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { fr } from "react-day-picker/locale"
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
import { formatDateTime } from "@/lib/format"
import { CURRENT_USER } from "@/lib/mocks/clients"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { Client, RecurringSlot } from "@/lib/mocks/types"
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
  const tz = client.timezone
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
  const isLate = iso !== null && new Date(iso).getTime() < MOCK_NOW.getTime() + MIN_LEAD_MS
  const blocked = blockingCount > 0
  const confirmDisabled = blocked || iso === null || (isLate && lateChoice === "repick")

  function applyShortcut(shortcutIso: string) {
    const wc = wallClockIn(shortcutIso, tz)
    setDay(new Date(wc.year, wc.month - 1, wc.day))
    setTime(`${pad(wc.hour)}:${pad(wc.minute)}`)
  }

  function confirm() {
    if (iso === null) return
    const finalIso = isLate ? new Date(MOCK_NOW.getTime() + ASAP_DELAY_MS).toISOString() : iso
    onConfirm(finalIso)
    onOpenChange(false)
    toast.success(
      isLate ? "Publication dès que possible (aperçu)" : "Programmation enregistrée (aperçu)",
      { description: `${formatDateTime(finalIso, tz)} — fuseau du client (${tz}).` }
    )
  }

  function removeDate() {
    onConfirm(null)
    onOpenChange(false)
    toast.info("Date retirée (aperçu)", {
      description: "Le contenu repart dans l'étagère « À planifier ».",
    })
  }

  const nowWc = wallClockIn(MOCK_NOW, tz)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Programmer la publication</DialogTitle>
          <DialogDescription>
            Date et heure saisies dans le fuseau du client : <strong>{tz}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((s) => (
              <Button key={s.id} variant="outline" size="xs" onClick={() => applyShortcut(s.iso)}>
                <CalendarClock />
                {s.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              defaultMonth={day ?? new Date(nowWc.year, nowWc.month - 1, nowWc.day)}
              locale={fr}
              className="rounded-lg border"
            />
            <div className="w-full space-y-1.5 sm:w-36">
              <Label htmlFor="composer-time">Heure ({tz})</Label>
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
                Publication : {formatDateTime(iso, tz)}{" "}
                <span className="font-normal text-muted-foreground">(fuseau du client)</span>
              </p>
              {CURRENT_USER.timezone !== tz ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Soit {formatDateTime(iso, CURRENT_USER.timezone)} dans ton fuseau (
                  {CURRENT_USER.timezone}).
                </p>
              ) : null}
            </div>
          ) : null}

          {isLate ? (
            <div className="space-y-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm font-medium text-warning">
                Ce créneau est déjà passé (ou à moins de 15 min).
              </p>
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
                      Publier dès que possible
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Rattrapage immédiat — au-delà de {GRACE_WINDOW_HOURS} h de retard, un contenu
                      passe en échec et doit être reprogrammé.
                    </span>
                  </span>
                </Label>
                <Label className="flex items-start gap-2 font-normal">
                  <RadioGroupItem value="repick" className="mt-0.5" />
                  <span>
                    <span className="font-medium">Choisir une autre date</span>
                    <span className="block text-xs text-muted-foreground">
                      Sélectionne un créneau futur (≥ maintenant + 15 min).
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
          ) : null}

          {blocked ? (
            <p className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs font-medium text-destructive">
              <CircleAlert className="mt-px size-3.5 shrink-0" />
              Pré-flight bloquant : {blockingCount} point{blockingCount > 1 ? "s" : ""} à corriger
              avant de programmer (voir le panneau Pré-flight).
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {scheduledAt ? (
            <Button variant="destructive" onClick={removeDate} className="sm:mr-auto">
              Retirer la date
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={confirm} disabled={confirmDisabled}>
            <CalendarClock />
            Programmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
