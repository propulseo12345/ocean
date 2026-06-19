"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

// Règles d'automatisation par client (aperçu) : état local + toasts. Le report
// auto sur quota atteint correspond au comportement réel acté côté worker.

interface AutomationRule {
  id: string
  label: string
  description: string
  enabled: boolean
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "remind_empty_week",
    label: "Rappel si aucun post planifié à J-7",
    description: "Une notification te prévient quand la semaine à venir est vide pour ce client.",
    enabled: true,
  },
  {
    id: "remind_reviewer",
    label: "Relance du client après 48 h sans validation",
    description: "Un rappel est envoyé automatiquement au Reviewer (email + portail).",
    enabled: false,
  },
  {
    id: "quota_defer",
    label: "Report automatique si quota Instagram atteint",
    description:
      "Comportement standard d'Ocean : le post est décalé au prochain créneau et tu es notifié du déplacement.",
    enabled: true,
  },
  {
    id: "publish_on_approval",
    label: "Publication automatique dès approbation",
    description:
      "Uniquement si la date prévue est à plus de 15 minutes — une approbation tardive ne publie jamais seule.",
    enabled: false,
  },
]

export function AutomationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rules, setRules] = useState(DEFAULT_RULES)

  function toggleRule(id: string, enabled: boolean) {
    const rule = rules.find((r) => r.id === id)
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
    toast.info(`Règle ${enabled ? "activée" : "désactivée"} (aperçu)`, {
      description: rule?.label,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Automatisations du client</DialogTitle>
          <DialogDescription>
            Règles de workflow propres à ce client. Aperçu — elles seront actives avec le backend.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{rule.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {rule.description}
                </p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                aria-label={rule.label}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
