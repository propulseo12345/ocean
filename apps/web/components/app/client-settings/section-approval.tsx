"use client"

import { Bell, Clock, Mail, ShieldCheck, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatRelative } from "@/lib/format"
import type { ApprovalMode, Client, Reviewer } from "@/lib/mocks/types"
import { REMINDER_DELAY_BOUNDS, REMINDER_DELAY_DEFAULT } from "./constants"
import { SaveBar, SectionCard } from "./section-card"

interface ModeOption {
  value: ApprovalMode
  label: string
  impact: string
}

// Clampe la saisie du délai de relance entre les bornes ; champ vidé (NaN) →
// valeur par défaut, jamais 0 hors bornes.
function clampReminder(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return REMINDER_DELAY_DEFAULT
  return Math.min(REMINDER_DELAY_BOUNDS.max, Math.max(REMINDER_DELAY_BOUNDS.min, Math.round(n)))
}

const MODES: ModeOption[] = [
  {
    value: "required",
    label: "Validation obligatoire",
    impact:
      "Aucune publication sans l'accord du relecteur. Chaque contenu passe par le portail avant d'être programmé.",
  },
  {
    value: "optional",
    label: "Validation optionnelle",
    impact:
      "L'envoi en revue est proposé par défaut mais tu peux programmer directement, contenu par contenu.",
  },
  {
    value: "auto",
    label: "Publication directe",
    impact:
      "Aucun passage par le portail : les contenus programmés partent à l'heure prévue, sous ta seule responsabilité.",
  },
]

export function SectionApproval({
  client,
  reviewer,
}: {
  client: Client
  reviewer: Reviewer | undefined
}) {
  const [mode, setMode] = useState<ApprovalMode>(client.approvalMode)
  const [reminderDays, setReminderDays] = useState(REMINDER_DELAY_DEFAULT)
  const reminderDisabled = mode === "auto"

  const dirty = mode !== client.approvalMode

  function save() {
    toast.success("Niveau de validation enregistré (aperçu)", {
      description: MODES.find((m) => m.value === mode)?.label,
    })
  }

  function invite() {
    toast.info("Invitation relecteur simulée (aperçu)", {
      description: "Un email d'invitation au portail partira via Brevo une fois le backend câblé.",
    })
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Niveau de validation"
      description="Définit qui doit approuver un contenu avant publication pour ce client."
    >
      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as ApprovalMode)}
        className="gap-2.5"
      >
        {MODES.map((option) => (
          <Label
            key={option.value}
            className="flex items-start gap-2.5 rounded-lg border p-3 font-normal has-data-checked:border-primary/50 has-data-checked:bg-primary/5"
          >
            <RadioGroupItem value={option.value} className="mt-0.5" />
            <span className="min-w-0">
              <span className="font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {option.impact}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>

      <div className="rounded-lg border">
        <div className="flex items-center gap-3 px-3 py-3">
          {reviewer ? (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {reviewer.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{reviewer.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="size-3" />
                  {reviewer.email}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {reviewer.lastActiveAt
                  ? `Vu ${formatRelative(reviewer.lastActiveAt)}`
                  : "Jamais venu sur le portail"}
              </span>
            </>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">
              Aucun relecteur rattaché à ce client.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={invite}>
            <UserPlus />
            <span className="hidden sm:inline">Inviter</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Label
            htmlFor="reminder-days"
            className="font-normal text-muted-foreground"
            data-disabled={reminderDisabled}
          >
            <Bell className="size-4" />
            Relancer le relecteur sans réponse après
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="reminder-days"
              type="number"
              min={REMINDER_DELAY_BOUNDS.min}
              max={REMINDER_DELAY_BOUNDS.max}
              value={reminderDays}
              disabled={reminderDisabled}
              onChange={(e) => setReminderDays(clampReminder(e.target.value))}
              className="w-16 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">jour(s)</span>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
        Une approbation tardive ne déclenche jamais de publication automatique : passé l'heure, le
        contenu te revient pour reprogrammation.
      </p>

      <SaveBar dirty={dirty} onSave={save} />
    </SectionCard>
  )
}
