"use client"

import { CalendarPlus, Clock, X } from "lucide-react"
import { useState } from "react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLabels, useT } from "@/lib/i18n"
import type { Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { CONNECTABLE_PLATFORMS, type DraftSlot, WEEKDAYS } from "./wizard-types"

// Éditeur de créneaux récurrents : jour + heure + plateformes. Reflète les
// rendez-vous de publication convenus avec le client (heure locale client).

// Compteur stable (jamais Date.now() : déterministe et SSR-safe) pour les ids
// des créneaux brouillon créés à la volée.
let counter = 0
function nextId() {
  counter += 1
  return `dslot_${counter}`
}

export function SlotEditor({
  slots,
  onChange,
}: {
  slots: DraftSlot[]
  onChange: (slots: DraftSlot[]) => void
}) {
  const t = useT()
  const lbl = useLabels()
  const weekdayLabel = (weekday: number) => {
    const key = WEEKDAYS.find((d) => d.value === weekday)?.labelKey
    return key ? t(key) : t("onboarding.slot.dayFallback")
  }
  const [weekday, setWeekday] = useState("2")
  const [time, setTime] = useState("11:30")
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram"])

  function add() {
    if (platforms.length === 0) return
    onChange([...slots, { id: nextId(), weekday: Number(weekday), time, platforms }])
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  return (
    <div className="space-y-3">
      {slots.length > 0 ? (
        <ul className="space-y-2">
          {[...slots]
            .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
            .map((slot) => (
              <li
                key={slot.id}
                className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5 text-sm"
              >
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{weekdayLabel(slot.weekday)}</span>
                <span className="tabular-nums text-muted-foreground">{slot.time}</span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  {slot.platforms.map((p) => (
                    <PlatformIcon key={p} platform={p} className="size-3.5" />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(slots.filter((x) => x.id !== slot.id))}
                  aria-label={t("onboarding.slot.removeAria")}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
        </ul>
      ) : null}

      <div className="space-y-2.5 rounded-lg border border-dashed p-3">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slot-weekday">{t("onboarding.slot.dayLabel")}</Label>
            <Select value={weekday} onValueChange={(v) => setWeekday(String(v))}>
              <SelectTrigger id="slot-weekday" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {t(d.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-time">{t("onboarding.slot.timeLabel")}</Label>
            <Input
              id="slot-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t("onboarding.slot.platformsLegend")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {CONNECTABLE_PLATFORMS.map((p) => {
              const active = platforms.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <PlatformIcon platform={p} className="size-3.5" />
                  {lbl.platform(p)}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={platforms.length === 0}
        >
          <CalendarPlus />
          {t("onboarding.slot.addSlot")}
        </Button>
      </div>
    </div>
  )
}
