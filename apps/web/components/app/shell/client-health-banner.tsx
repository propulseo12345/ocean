"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { isPast } from "@/lib/format"
import { useLabels, useT } from "@/lib/i18n"
import type { ContentItem, SocialAccount } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { clientAccountIssues } from "./client-nav"

// Bandeau santé des connexions au niveau client : visible sur toutes les pages
// de l'espace client dès qu'un compte est needs_reauth / expiré, avec l'impact
// concret (« N publications à venir échoueront »).

const AT_RISK_STATUSES: ContentItem["status"][] = ["approved", "scheduled", "publishing"]

function upcomingAtRisk(items: ContentItem[], accountIds: Set<string>): number {
  return items.filter(
    (c) =>
      c.scheduledAt &&
      !isPast(c.scheduledAt) &&
      AT_RISK_STATUSES.includes(c.status) &&
      c.targets.some((t) => t.socialAccountId !== null && accountIds.has(t.socialAccountId))
  ).length
}

export function ClientHealthBanner({
  clientId,
  contentItems,
  socialAccounts,
}: {
  clientId: string
  contentItems: ContentItem[]
  socialAccounts: SocialAccount[]
}) {
  const t = useT()
  const lbl = useLabels()
  const issues = clientAccountIssues(socialAccounts, clientId)
  if (issues.length === 0) return null

  const danger = issues.some((a) => a.status === "expired")
  const platforms = issues.map((a) => lbl.platform(a.platform)).join(", ")
  const atRisk = upcomingAtRisk(contentItems, new Set(issues.map((a) => a.id)))

  const impact =
    atRisk > 0
      ? t("nav.health.impactAtRisk", { count: atRisk })
      : t("nav.health.impactReconnect", { username: issues[0].username })

  function handleReconnect() {
    toast.info(t("nav.health.reconnectToast", { platforms }), {
      description: t("nav.health.reconnectToastDesc"),
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
        {danger
          ? t("nav.health.titleExpired", { platforms, count: issues.length })
          : t("nav.health.titleDisconnected", { platforms, count: issues.length })}
      </AlertTitle>
      <AlertDescription>{impact}</AlertDescription>
      <AlertAction className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={handleReconnect}>
          {t("nav.health.reconnect")}
        </Button>
        <Button size="sm" variant="ghost" render={<Link href={routes.settings} />}>
          {t("nav.health.settings")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
