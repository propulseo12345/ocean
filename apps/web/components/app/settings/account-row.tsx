"use client"

import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { SocialAccount } from "@/lib/domain"
import { useFormat, useLabels, useT } from "@/lib/i18n"

export function AccountRow({ account }: { account: SocialAccount }) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const needsAttention = account.status !== "connected"
  const platformLabel = lbl.platform(account.platform)

  function handleReconnect() {
    toast.warning(t("settings.accounts.reconnectToast", { platform: platformLabel }), {
      description: t("settings.accounts.reconnectToastDescription"),
    })
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <PlatformIcon platform={account.platform} className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {platformLabel}
          <span className="truncate font-normal text-muted-foreground">@{account.username}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t("settings.accounts.followers", { count: f.followers(account.followers) })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} className="hidden sm:inline-flex" />
        {needsAttention ? (
          <Button size="sm" variant="outline" onClick={handleReconnect}>
            <RefreshCw />
            {t("settings.accounts.reconnect")}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
