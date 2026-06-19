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
import { type MessageKey, useT } from "@/lib/i18n"

// Règles d'automatisation par client (aperçu) : état local + toasts. Le report
// auto sur quota atteint correspond au comportement réel acté côté worker.

interface AutomationRule {
  id: string
  labelKey: MessageKey
  descriptionKey: MessageKey
  enabled: boolean
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "remind_empty_week",
    labelKey: "calendar.automation.rules.remindEmptyWeekLabel",
    descriptionKey: "calendar.automation.rules.remindEmptyWeekDesc",
    enabled: true,
  },
  {
    id: "remind_reviewer",
    labelKey: "calendar.automation.rules.remindReviewerLabel",
    descriptionKey: "calendar.automation.rules.remindReviewerDesc",
    enabled: false,
  },
  {
    id: "quota_defer",
    labelKey: "calendar.automation.rules.quotaDeferLabel",
    descriptionKey: "calendar.automation.rules.quotaDeferDesc",
    enabled: true,
  },
  {
    id: "publish_on_approval",
    labelKey: "calendar.automation.rules.publishOnApprovalLabel",
    descriptionKey: "calendar.automation.rules.publishOnApprovalDesc",
    enabled: false,
  },
]

export function AutomationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [rules, setRules] = useState(DEFAULT_RULES)

  function toggleRule(id: string, enabled: boolean) {
    const rule = rules.find((r) => r.id === id)
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
    toast.info(t("calendar.automation.ruleToggled", { state: enabled ? "on" : "off" }), {
      description: rule ? t(rule.labelKey) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("calendar.automation.title")}</DialogTitle>
          <DialogDescription>{t("calendar.automation.description")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(rule.labelKey)}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t(rule.descriptionKey)}
                </p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                aria-label={t(rule.labelKey)}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
