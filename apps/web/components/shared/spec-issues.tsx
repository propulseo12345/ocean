"use client"

import { CircleAlert, TriangleAlert } from "lucide-react"
import { useT } from "@/lib/i18n"
import type { SpecIssue } from "@/lib/specs"
import { cn } from "@/lib/utils"

// Liste compacte d'avertissements de specs média (composer, pré-flight).
// Résout les messages {key, params} via t() (bilingue).

export function SpecIssues({ issues, className }: { issues: SpecIssue[]; className?: string }) {
  const t = useT()
  if (issues.length === 0) return null

  return (
    <ul className={cn("space-y-1", className)}>
      {issues.map((issue) => {
        const error = issue.severity === "error"
        const Icon = error ? CircleAlert : TriangleAlert
        return (
          <li
            key={`${issue.severity}_${issue.key}`}
            className={cn(
              "flex items-start gap-1.5 text-xs",
              error ? "text-destructive" : "text-warning"
            )}
          >
            <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">
                {error ? `${t("specs.errorPrefix")} ` : `${t("specs.warningPrefix")} `}
              </span>
              {t(issue.key, issue.params)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
