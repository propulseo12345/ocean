"use client"

import { Bell, Clock, Mail, ShieldCheck, UserPlus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { updateApprovalSettings } from "@/lib/actions/client-settings"
import { type MessageKey, useFormat, useLabels, useT } from "@/lib/i18n"
import type { ApprovalMode, Client, Reviewer } from "@/lib/mocks/types"
import { REMINDER_DELAY_BOUNDS, REMINDER_DELAY_DEFAULT } from "./constants"
import { SaveBar, SectionCard } from "./section-card"

interface ModeOption {
  value: ApprovalMode
  labelKey: MessageKey
  impactKey: MessageKey
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
    labelKey: "clientSettings.approval.requiredLabel",
    impactKey: "clientSettings.approval.requiredImpact",
  },
  {
    value: "optional",
    labelKey: "clientSettings.approval.optionalLabel",
    impactKey: "clientSettings.approval.optionalImpact",
  },
  {
    value: "auto",
    labelKey: "clientSettings.approval.autoLabel",
    impactKey: "clientSettings.approval.autoImpact",
  },
]

export function SectionApproval({
  client,
  reviewer,
  reminderDays: initialReminderDays,
}: {
  client: Client
  reviewer: Reviewer | undefined
  reminderDays: number
}) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<ApprovalMode>(client.approvalMode)
  const [reminderDays, setReminderDays] = useState(initialReminderDays)
  const reminderDisabled = mode === "auto"

  // Le délai de relance compte AUSSI dans dirty (bug corrigé : sans lui, modifier
  // seul le délai laissait le bouton Enregistrer désactivé — valeur insauvable).
  const dirty = mode !== client.approvalMode || reminderDays !== initialReminderDays

  function save() {
    startTransition(async () => {
      const res = await updateApprovalSettings({ clientId: client.id, mode, reminderDays })
      if (res.ok) {
        toast.success(t("clientSettings.approval.savedToast"), {
          description: lbl.approvalMode(mode),
        })
      } else {
        toast.error(t("clientSettings.saveBar.error"))
      }
    })
  }

  function invite() {
    toast.info(t("clientSettings.approval.inviteToast"), {
      description: t("clientSettings.approval.inviteToastDescription"),
    })
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title={t("clientSettings.approval.title")}
      description={t("clientSettings.approval.description")}
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
              <span className="font-medium">{t(option.labelKey)}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {t(option.impactKey)}
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
                  ? t("clientSettings.approval.seenAt", { when: f.relative(reviewer.lastActiveAt) })
                  : t("clientSettings.approval.neverVisited")}
              </span>
            </>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">
              {t("clientSettings.approval.noReviewer")}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={invite}>
            <UserPlus />
            <span className="hidden sm:inline">{t("clientSettings.approval.invite")}</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Label
            htmlFor="reminder-days"
            className="font-normal text-muted-foreground"
            data-disabled={reminderDisabled}
          >
            <Bell className="size-4" />
            {t("clientSettings.approval.reminderLabel")}
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
            <span className="text-sm text-muted-foreground">
              {t("clientSettings.approval.reminderUnit")}
            </span>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("clientSettings.approval.lateNote")}
      </p>

      <SaveBar dirty={dirty && !pending} onSave={save} />
    </SectionCard>
  )
}
