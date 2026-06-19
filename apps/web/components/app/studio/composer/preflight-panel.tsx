"use client"

import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PreflightItem, PreflightSeverity } from "./preflight"

// Panneau pré-flight : checklist verte / orange / rouge calculée en continu.
// Les erreurs bloquent (visuellement) la programmation dans le dialog.

const ICONS = {
  ok: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const

const ICON_CLASS: Record<PreflightSeverity, string> = {
  ok: "text-success",
  warning: "text-warning",
  error: "text-destructive",
}

export function PreflightPanel({ items }: { items: PreflightItem[] }) {
  const t = useT()
  const errors = items.filter((i) => i.severity === "error").length
  const warnings = items.filter((i) => i.severity === "warning").length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("composer.preflight.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2.5">
          {items.map((item) => {
            const Icon = ICONS[item.severity]
            return (
              <li key={item.id} className="flex items-start gap-2">
                <Icon className={cn("mt-px size-4 shrink-0", ICON_CLASS[item.severity])} />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      item.severity === "error" && "font-medium text-destructive"
                    )}
                  >
                    <span className="sr-only">
                      {item.severity === "error"
                        ? t("composer.preflight.srBlocking")
                        : item.severity === "warning"
                          ? t("composer.preflight.srWarning")
                          : t("composer.preflight.srOk")}
                    </span>
                    {item.label}
                  </p>
                  {item.detail ? (
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>

        <p
          className={cn(
            "rounded-lg border p-2.5 text-xs font-medium",
            errors > 0
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : warnings > 0
                ? "border-warning/30 bg-warning/5 text-warning"
                : "border-success/30 bg-success/5 text-success"
          )}
        >
          {errors > 0
            ? t("composer.preflight.summaryBlocking", { count: errors })
            : warnings > 0
              ? t("composer.preflight.summaryWarnings", { count: warnings })
              : t("composer.preflight.summaryReady")}
        </p>
      </CardContent>
    </Card>
  )
}
