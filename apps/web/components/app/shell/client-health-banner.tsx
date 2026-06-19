"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { isPast } from "@/lib/format"
import { getContentItems } from "@/lib/mocks"
import { platformMeta } from "@/lib/mocks/labels"
import type { ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { clientAccountIssues } from "./client-nav"

// Bandeau santé des connexions au niveau client : visible sur toutes les pages
// de l'espace client dès qu'un compte est needs_reauth / expiré, avec l'impact
// concret (« N publications à venir échoueront »).

const AT_RISK_STATUSES: ContentItem["status"][] = ["approved", "scheduled", "publishing"]

function upcomingAtRisk(clientId: string, accountIds: Set<string>): number {
  return getContentItems(clientId).filter(
    (c) =>
      c.scheduledAt &&
      !isPast(c.scheduledAt) &&
      AT_RISK_STATUSES.includes(c.status) &&
      c.targets.some((t) => t.socialAccountId !== null && accountIds.has(t.socialAccountId))
  ).length
}

export function ClientHealthBanner({ clientId }: { clientId: string }) {
  const issues = clientAccountIssues(clientId)
  if (issues.length === 0) return null

  const danger = issues.some((a) => a.status === "expired")
  const platforms = issues.map((a) => platformMeta[a.platform].label).join(", ")
  const atRisk = upcomingAtRisk(clientId, new Set(issues.map((a) => a.id)))

  const impact =
    atRisk > 0
      ? `${atRisk} publication${atRisk > 1 ? "s" : ""} à venir échouer${atRisk > 1 ? "ont" : "a"} si le compte n'est pas reconnecté.`
      : `Le compte @${issues[0].username} doit être reconnecté pour continuer à publier.`

  function handleReconnect() {
    toast.info(`Reconnexion ${platforms} simulée (aperçu)`, {
      description: "Aucun compte n'est réellement reconnecté pendant la preview.",
    })
  }

  return (
    <Alert
      className={cn(
        "items-center",
        danger ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
      )}
    >
      <TriangleAlert className={danger ? "text-destructive" : "text-warning"} />
      <AlertTitle>
        {platforms} {(danger ? "expiré" : "déconnecté") + (issues.length > 1 ? "s" : "")}
      </AlertTitle>
      <AlertDescription>{impact}</AlertDescription>
      <AlertAction className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={handleReconnect}>
          Reconnecter (aperçu)
        </Button>
        <Button size="sm" variant="ghost" render={<Link href={routes.settings} />}>
          Réglages
        </Button>
      </AlertAction>
    </Alert>
  )
}
