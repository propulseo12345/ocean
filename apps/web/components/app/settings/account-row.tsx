"use client"

import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatFollowers } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import type { SocialAccount } from "@/lib/mocks/types"

export function AccountRow({ account }: { account: SocialAccount }) {
  const needsAttention = account.status !== "connected"
  const platformLabel = platformMeta[account.platform].label

  function handleReconnect() {
    toast.warning(`Reconnexion ${platformLabel}`, {
      description: "Action simulée (preview) — l'authentification s'ouvrira ici.",
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
          {formatFollowers(account.followers)} abonnés
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} className="hidden sm:inline-flex" />
        {needsAttention ? (
          <Button size="sm" variant="outline" onClick={handleReconnect}>
            <RefreshCw />
            Reconnecter
          </Button>
        ) : null}
      </div>
    </li>
  )
}
