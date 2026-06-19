"use client"

import { Minus, Plus, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CADENCE_DEFAULTS, DENSITY_BOUNDS, GAP_BOUNDS } from "./constants"
import { SaveBar, SectionCard } from "./section-card"

interface AlertToggle {
  id: string
  label: string
  enabled: boolean
}

// État initial des alertes par id → résistant à un réordonnancement de la liste.
const DEFAULT_ALERTS: Record<string, boolean> = {
  empty_week: true,
  gap: true,
  collision: false,
}

export function SectionCadence() {
  const [gapDays, setGapDays] = useState<number>(CADENCE_DEFAULTS.gapDays)
  const [maxPerDay, setMaxPerDay] = useState<number>(CADENCE_DEFAULTS.maxPerDay)
  const [alerts, setAlerts] = useState<AlertToggle[]>([
    { id: "empty_week", label: "Me prévenir si le calendrier est vide à J-7", enabled: true },
    { id: "gap", label: "Signaler un trou de cadence au-delà du seuil ci-dessus", enabled: true },
    {
      id: "collision",
      label: "Avertir si deux posts du même jour sont à moins d'une heure",
      enabled: false,
    },
  ])

  const dirty =
    gapDays !== CADENCE_DEFAULTS.gapDays ||
    maxPerDay !== CADENCE_DEFAULTS.maxPerDay ||
    alerts.some((a) => a.enabled !== DEFAULT_ALERTS[a.id])

  function save() {
    toast.success("Seuils de cadence enregistrés (aperçu)", {
      description: `Trou : ${gapDays} j · densité max : ${maxPerDay}/jour`,
    })
  }

  function toggle(id: string, enabled: boolean) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)))
  }

  return (
    <SectionCard
      icon={TriangleAlert}
      title="Cadence & alertes"
      description="Seuils de détection des trous et de la densité, pour protéger la régularité vendue au client."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Stepper
          label="Trou de cadence"
          hint="Alerter après ce nombre de jours sans aucun post planifié."
          value={gapDays}
          unit="jours"
          min={GAP_BOUNDS.min}
          max={GAP_BOUNDS.max}
          onChange={setGapDays}
        />
        <Stepper
          label="Densité maximale"
          hint="Avertir au-delà de ce nombre de posts le même jour."
          value={maxPerDay}
          unit="/ jour"
          min={DENSITY_BOUNDS.min}
          max={DENSITY_BOUNDS.max}
          onChange={setMaxPerDay}
        />
      </div>

      <ul className="space-y-3 border-t pt-4">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex items-center justify-between gap-3">
            <Label htmlFor={`alert-${alert.id}`} className="font-normal">
              {alert.label}
            </Label>
            <Switch
              id={`alert-${alert.id}`}
              checked={alert.enabled}
              onCheckedChange={(checked) => toggle(alert.id, checked)}
              aria-label={alert.label}
            />
          </li>
        ))}
      </ul>

      <SaveBar dirty={dirty} onSave={save} />
    </SectionCard>
  )
}

function Stepper({
  label,
  hint,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string
  hint: string
  value: number
  unit: string
  min: number
  max: number
  onChange: (next: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`Diminuer ${label}`}
        >
          <Minus />
        </Button>
        <span className="min-w-16 text-center text-sm font-semibold tabular-nums">
          {value} <span className="font-normal text-muted-foreground">{unit}</span>
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`Augmenter ${label}`}
        >
          <Plus />
        </Button>
        <ProgressTrack value={value} min={min} max={max} />
      </div>
    </div>
  )
}

function ProgressTrack({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={cn("h-1.5 flex-1 overflow-hidden rounded-full bg-muted")} aria-hidden>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
