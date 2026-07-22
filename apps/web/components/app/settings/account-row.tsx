"use client"

import { RefreshCw } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { Platform, SocialAccount } from "@/lib/domain"
import { useFormat, useLabels, useT } from "@/lib/i18n"

// Instagram + Facebook se reconnectent via Meta (Facebook Login) ; TikTok a son
// propre provider. La reconnexion relance le MÊME flux OAuth pour le client.
function providerFor(platform: Platform): "meta" | "tiktok" | null {
  if (platform === "instagram" || platform === "facebook") return "meta"
  if (platform === "tiktok") return "tiktok"
  return null
}

export function AccountRow({ account }: { account: SocialAccount }) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const needsAttention = account.status !== "connected"
  const platformLabel = lbl.platform(account.platform)
  const provider = providerFor(account.platform)
  const reconnectHref = provider ? `/api/oauth/${provider}?clientId=${account.clientId}` : undefined

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
        {needsAttention && reconnectHref ? (
          <Button size="sm" variant="outline" render={<a href={reconnectHref} />}>
            <RefreshCw />
            {t("settings.accounts.reconnect")}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
