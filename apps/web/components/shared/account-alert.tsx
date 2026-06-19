"use client"

import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useLabels, useT } from "@/lib/i18n"
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
  const t = useT()
  const lbl = useLabels()

  if (account.status === "connected") return null

  const platformLabel = lbl.platform(account.platform)
  const statusLabel = lbl.accountStatus(account.status)
  const danger = account.status === "expired"

  function handleReconnect() {
    toast.info(t("portal.shared.reconnectSimulated", { platform: platformLabel }), {
      description: t("portal.shared.reconnectSimulatedDetail"),
    })
  }

  if (variant === "inline") {
    return (
      <span
        title={t("portal.shared.inlineTitle", {
          username: account.username,
          status: statusLabel.toLowerCase(),
        })}
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
        {t("portal.shared.accountStatusTitle", {
          platform: platformLabel,
          status: statusLabel.toLowerCase(),
        })}
      </AlertTitle>
      <AlertDescription>
        {impact ?? t("portal.shared.reconnectImpact", { username: account.username })}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={handleReconnect}>
          {t("portal.shared.reconnect")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
