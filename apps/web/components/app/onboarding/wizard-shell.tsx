"use client"

import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useT } from "@/lib/i18n"
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

const STEP_IDS: WizardStepId[] = ["identity", "accounts", "brand", "strategy", "review"]

// Étapes 3 et 4 sont facultatives : on peut les passer (« Passer cette étape »).
const SKIPPABLE: WizardStepId[] = ["brand", "strategy"]

export function WizardShell() {
  const t = useT()
  const router = useRouter()

  const STEPS: StepDef[] = STEP_IDS.map((id) => ({
    id,
    label: t(`onboarding.steps.${id}`),
  }))
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
      toast.warning(t("onboarding.shell.identityRequired"))
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
      toast.warning(t("onboarding.shell.identityRequired"))
      firstFieldRef.current?.focus()
      return
    }
    goTo(index + 1)
  }

  function create() {
    if (!reviewerEmailOk) {
      toast.warning(t("onboarding.shell.reviewerEmailFix"))
      return
    }
    const name = draft.name.trim() || t("onboarding.shell.defaultClientName")
    toast.success(t("onboarding.shell.clientCreated", { name }), {
      description: draft.reviewerEmail.trim()
        ? t("onboarding.shell.clientCreatedWithReviewer")
        : t("onboarding.shell.clientCreatedNoReviewer"),
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
        <Progress
          value={((index + 1) / STEPS.length) * 100}
          aria-label={t("onboarding.shell.progressLabel")}
        />
      </div>

      <div className="space-y-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold tracking-tight outline-none"
        >
          {t(`onboarding.stepTitle.${step.id}`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`onboarding.stepDescription.${step.id}`)}
        </p>
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
        <p className="text-sm text-destructive">{t("onboarding.shell.identityRequiredHint")}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft />
          {t("common.previous")}
        </Button>

        <div className="flex items-center gap-2">
          {SKIPPABLE.includes(step.id) ? (
            <Button variant="outline" onClick={() => goTo(index + 1)}>
              <SkipForward />
              {t("onboarding.shell.skip")}
            </Button>
          ) : null}
          {isLast ? (
            <Button onClick={create} disabled={!reviewerEmailOk}>
              <Check />
              {t("onboarding.shell.createClient")}
            </Button>
          ) : (
            <Button onClick={next} disabled={!canAdvance}>
              {t("common.next")}
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
