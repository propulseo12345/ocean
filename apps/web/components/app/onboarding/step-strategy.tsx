"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { type MessageKey, useLabels, useT } from "@/lib/i18n"
import type { ApprovalMode } from "@/lib/mocks/types"
import { PillarEditor } from "./pillar-editor"
import { SlotEditor } from "./slot-editor"
import type { ClientDraft } from "./wizard-types"

// Étape 4 — stratégie de contenu : piliers + jauge de mix, créneaux récurrents,
// niveau de validation client (= approvalMode, avec explication de chaque mode).

const APPROVAL_MODES: { value: ApprovalMode; helpKey: MessageKey }[] = [
  { value: "required", helpKey: "onboarding.strategy.approvalHelp.required" },
  { value: "optional", helpKey: "onboarding.strategy.approvalHelp.optional" },
  { value: "auto", helpKey: "onboarding.strategy.approvalHelp.auto" },
]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-0.5">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function StepStrategy({
  draft,
  patch,
}: {
  draft: ClientDraft
  patch: (partial: Partial<ClientDraft>) => void
}) {
  const t = useT()
  const lbl = useLabels()
  return (
    <div className="space-y-6">
      <Section
        title={t("onboarding.strategy.pillarsTitle")}
        description={t("onboarding.strategy.pillarsDescription")}
      >
        <PillarEditor
          pillars={draft.pillars}
          category={draft.category}
          onChange={(pillars) => patch({ pillars })}
        />
      </Section>

      <Section
        title={t("onboarding.strategy.slotsTitle")}
        description={t("onboarding.strategy.slotsDescription")}
      >
        <SlotEditor slots={draft.slots} onChange={(slots) => patch({ slots })} />
      </Section>

      <Section
        title={t("onboarding.strategy.approvalTitle")}
        description={t("onboarding.strategy.approvalDescription")}
      >
        <RadioGroup
          value={draft.approvalMode}
          onValueChange={(v) => patch({ approvalMode: v as ApprovalMode })}
          aria-label={t("onboarding.strategy.approvalLabel")}
          className="gap-2"
        >
          {APPROVAL_MODES.map((mode) => (
            <Label
              key={mode.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={mode.value} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{lbl.approvalMode(mode.value)}</span>
                <span className="block text-xs text-muted-foreground">{t(mode.helpKey)}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </Section>
    </div>
  )
}
