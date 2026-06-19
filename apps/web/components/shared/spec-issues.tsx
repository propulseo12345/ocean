import { CircleAlert, TriangleAlert } from "lucide-react"
import type { SpecIssue } from "@/lib/specs"
import { cn } from "@/lib/utils"

// Liste compacte d'avertissements de specs média (composer, pré-flight).
// Server-compatible : erreurs en destructive, avertissements en warning.

export function SpecIssues({ issues, className }: { issues: SpecIssue[]; className?: string }) {
  if (issues.length === 0) return null

  return (
    <ul className={cn("space-y-1", className)}>
      {issues.map((issue) => {
        const error = issue.severity === "error"
        const Icon = error ? CircleAlert : TriangleAlert
        return (
          <li
            key={`${issue.severity}_${issue.message}`}
            className={cn(
              "flex items-start gap-1.5 text-xs",
              error ? "text-destructive" : "text-warning"
            )}
          >
            <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">{error ? "Erreur : " : "Avertissement : "}</span>
              {issue.message}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
