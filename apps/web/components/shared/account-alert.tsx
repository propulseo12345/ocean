"use client"

import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { accountStatusMeta, platformMeta } from "@/lib/mocks/labels"
import type { SocialAccount } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Alerte santé d'un compte social (needs_reauth / expired).
// `banner` : bandeau pleine largeur avec CTA « Reconnecter » (toast aperçu).
// `inline` : badge discret pour les listes, cibles et en-têtes.

export function AccountAlert({
  account,
  variant = "banner",
  impact,
  className,
}: {
  account: SocialAccount
  variant?: "banner" | "inline"
  /** Impact concret, ex. « Les 3 publications de jeudi échoueront ». */
  impact?: string
  className?: string
}) {
  if (account.status === "connected") return null

  const platformLabel = platformMeta[account.platform].label
  const statusLabel = accountStatusMeta[account.status].label
  const danger = account.status === "expired"

  function handleReconnect() {
    toast.info(`Reconnexion ${platformLabel} simulée (aperçu)`, {
      description: "Aucun compte n'est réellement reconnecté pendant la preview.",
    })
  }

  if (variant === "inline") {
    return (
      <span
        title={`@${account.username} — ${statusLabel.toLowerCase()}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
          danger
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-warning/40 bg-warning/10 text-warning",
          className
        )}
      >
        <TriangleAlert className="size-3 shrink-0" />
        {statusLabel}
      </span>
    )
  }

  return (
    <Alert
      className={cn(
        danger ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5",
        className
      )}
    >
      <TriangleAlert className={danger ? "text-destructive" : "text-warning"} />
      <AlertTitle>
        {platformLabel} — {statusLabel.toLowerCase()}
      </AlertTitle>
      <AlertDescription>
        {impact ?? `Le compte @${account.username} doit être reconnecté pour continuer à publier.`}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={handleReconnect}>
          Reconnecter
        </Button>
      </AlertAction>
    </Alert>
  )
}
