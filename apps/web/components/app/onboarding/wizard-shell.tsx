"use client"

import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DEMO_REVIEWER_CLIENT_ID } from "@/lib/mocks"
import { routes } from "@/lib/routes"
import { StepAccounts } from "./step-accounts"
import { StepBrand } from "./step-brand"
import { StepIdentity } from "./step-identity"
import { StepReview } from "./step-review"
import { StepStrategy } from "./step-strategy"
import type { StepDef } from "./wizard-stepper"
import { WizardStepper } from "./wizard-stepper"
import {
  type ClientDraft,
  emptyDraft,
  isIdentityValid,
  isValidEmail,
  type WizardStepId,
} from "./wizard-types"

const STEPS: StepDef[] = [
  { id: "identity", label: "Identité" },
  { id: "accounts", label: "Comptes" },
  { id: "brand", label: "Marque" },
  { id: "strategy", label: "Stratégie" },
  { id: "review", label: "Récapitulatif" },
]

// Étapes 3 et 4 sont facultatives : on peut les passer (« Passer cette étape »).
const SKIPPABLE: WizardStepId[] = ["brand", "strategy"]

const STEP_TITLES: Record<WizardStepId, { title: string; description: string }> = {
  identity: { title: "Identité du client", description: "Les informations de base de la marque." },
  accounts: { title: "Comptes sociaux", description: "Connectez les réseaux à gérer." },
  brand: { title: "Identité de marque", description: "Palette, ton et garde-fous éditoriaux." },
  strategy: { title: "Stratégie de contenu", description: "Piliers, créneaux et validation." },
  review: { title: "Récapitulatif", description: "Vérifiez avant de créer le client." },
}

export function WizardShell() {
  const router = useRouter()
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft)
  const [index, setIndex] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [showIdentityError, setShowIdentityError] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const identityOk = isIdentityValid(draft)
  const canAdvance = step.id === "identity" ? identityOk : true
  const reviewerEmailOk =
    draft.reviewerEmail.trim().length === 0 || isValidEmail(draft.reviewerEmail)

  function patch(partial: Partial<ClientDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  // Focus sur le titre de l'étape (puis 1er champ à l'étape identité).
  useEffect(() => {
    if (step.id === "identity") {
      firstFieldRef.current?.focus()
    } else {
      headingRef.current?.focus()
    }
  }, [step.id])

  function goTo(target: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, target))
    // Garde de validité : tout saut EN AVANT (au-delà de l'étape identité)
    // exige une identité valide — sinon on bloque et on revient à l'étape 0.
    if (clamped > index && !identityOk) {
      setShowIdentityError(true)
      toast.warning("Renseignez le nom et l'identifiant du client pour continuer.")
      setIndex(0)
      firstFieldRef.current?.focus()
      return
    }
    setIndex(clamped)
    setMaxReached((m) => Math.max(m, clamped))
  }

  function next() {
    if (!canAdvance) {
      setShowIdentityError(true)
      toast.warning("Renseignez le nom et l'identifiant du client pour continuer.")
      firstFieldRef.current?.focus()
      return
    }
    goTo(index + 1)
  }

  function create() {
    if (!reviewerEmailOk) {
      toast.warning("Corrigez l'adresse email du valideur ou laissez le champ vide.")
      return
    }
    const name = draft.name.trim() || "Le client"
    toast.success(`${name} créé (aperçu)`, {
      description: draft.reviewerEmail.trim()
        ? "Invitation du valideur envoyée (aperçu) — aucune donnée enregistrée en preview."
        : "Aucune donnée n'est enregistrée en preview — câblage Supabase à venir.",
    })
    router.push(routes.clientGrid(DEMO_REVIEWER_CLIENT_ID))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <WizardStepper
          steps={STEPS}
          currentIndex={index}
          maxReachedIndex={maxReached}
          forwardLocked={!identityOk}
          onJump={goTo}
        />
        <Progress value={((index + 1) / STEPS.length) * 100} aria-label="Progression" />
      </div>

      <div className="space-y-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold tracking-tight outline-none"
        >
          {STEP_TITLES[step.id].title}
        </h2>
        <p className="text-sm text-muted-foreground">{STEP_TITLES[step.id].description}</p>
      </div>

      <div className="min-h-[18rem]">
        {step.id === "identity" ? (
          <StepIdentity draft={draft} patch={patch} firstFieldRef={firstFieldRef} />
        ) : null}
        {step.id === "accounts" ? <StepAccounts draft={draft} patch={patch} /> : null}
        {step.id === "brand" ? <StepBrand draft={draft} patch={patch} /> : null}
        {step.id === "strategy" ? <StepStrategy draft={draft} patch={patch} /> : null}
        {step.id === "review" ? (
          <StepReview
            draft={draft}
            patch={patch}
            onEdit={(target) => goTo(STEPS.findIndex((s) => s.id === target))}
          />
        ) : null}
      </div>

      {step.id === "identity" && showIdentityError && !identityOk ? (
        <p className="text-sm text-destructive">
          Le nom et l'identifiant sont requis pour passer à la suite.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft />
          Précédent
        </Button>

        <div className="flex items-center gap-2">
          {SKIPPABLE.includes(step.id) ? (
            <Button variant="outline" onClick={() => goTo(index + 1)}>
              <SkipForward />
              Passer
            </Button>
          ) : null}
          {isLast ? (
            <Button onClick={create} disabled={!reviewerEmailOk}>
              <Check />
              Créer le client
            </Button>
          ) : (
            <Button onClick={next} disabled={!canAdvance}>
              Suivant
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
