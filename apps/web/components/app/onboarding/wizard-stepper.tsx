"use client"

import { Check } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { WizardStepId } from "./wizard-types"

export interface StepDef {
  id: WizardStepId
  label: string
}

// Barre de progression du wizard : pastilles numérotées + libellés, lien fin
// visuel. Les étapes déjà atteintes sont cliquables (retour en arrière).

export function WizardStepper({
  steps,
  currentIndex,
  maxReachedIndex,
  forwardLocked = false,
  onJump,
}: {
  steps: StepDef[]
  currentIndex: number
  maxReachedIndex: number
  /** Avancée verrouillée (identité invalide) : aucune étape en avant n'est atteignable. */
  forwardLocked?: boolean
  onJump: (index: number) => void
}) {
  const t = useT()
  // High-water mark, mais plafonné à l'étape courante quand l'avancée est
  // verrouillée — la portée se recalcule alors depuis la validité, sans rester
  // figée sur un maximum jamais redescendu.
  const reachableMax = forwardLocked ? currentIndex : maxReachedIndex
  return (
    <nav aria-label={t("onboarding.stepper.navLabel")} className="w-full">
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const reachable = i <= reachableMax
          return (
            <li key={step.id} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  reachable ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && "border-primary/40 bg-primary/10 text-primary",
                    !active && !done && "border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:inline",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    i < currentIndex ? "bg-primary/40" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
