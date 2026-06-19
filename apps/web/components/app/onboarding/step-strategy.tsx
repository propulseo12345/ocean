"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { approvalModeMeta } from "@/lib/mocks/labels"
import type { ApprovalMode } from "@/lib/mocks/types"
import { PillarEditor } from "./pillar-editor"
import { SlotEditor } from "./slot-editor"
import type { ClientDraft } from "./wizard-types"

// Étape 4 — stratégie de contenu : piliers + jauge de mix, créneaux récurrents,
// niveau de validation client (= approvalMode, avec explication de chaque mode).

const APPROVAL_MODES: { value: ApprovalMode; help: string }[] = [
  {
    value: "required",
    help: "Chaque publication passe par le portail : rien ne part sans le feu vert du client.",
  },
  {
    value: "optional",
    help: "Vous décidez au cas par cas si une publication a besoin d'une validation.",
  },
  {
    value: "auto",
    help: "Les publications partent directement à l'heure prévue, sans étape de validation.",
  },
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
  return (
    <div className="space-y-6">
      <Section
        title="Piliers de contenu"
        description="Les grands thèmes éditoriaux du client, avec une part cible — pour garder un mois équilibré."
      >
        <PillarEditor
          pillars={draft.pillars}
          category={draft.category}
          onChange={(pillars) => patch({ pillars })}
        />
      </Section>

      <Section
        title="Créneaux de publication récurrents"
        description="Les rendez-vous convenus avec le client (jour, heure locale, plateformes)."
      >
        <SlotEditor slots={draft.slots} onChange={(slots) => patch({ slots })} />
      </Section>

      <Section
        title="Niveau de validation"
        description="Comment les publications sont validées avant de partir."
      >
        <RadioGroup
          value={draft.approvalMode}
          onValueChange={(v) => patch({ approvalMode: v as ApprovalMode })}
          aria-label="Niveau de validation du client"
          className="gap-2"
        >
          {APPROVAL_MODES.map((mode) => (
            <Label
              key={mode.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={mode.value} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {approvalModeMeta[mode.value].label}
                </span>
                <span className="block text-xs text-muted-foreground">{mode.help}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </Section>
    </div>
  )
}
