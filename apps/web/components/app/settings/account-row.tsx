"use client"

import { Link2Off, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { detachSocialAccount } from "@/lib/actions/social-accounts"
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
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const détaché = account.status === "disconnected"
  const needsAttention = account.status !== "connected" && !détaché
  const platformLabel = lbl.platform(account.platform)
  const provider = providerFor(account.platform)
  const reconnectHref = provider ? `/api/oauth/${provider}?clientId=${account.clientId}` : undefined

  function détacher() {
    startTransition(async () => {
      const res = await detachSocialAccount({
        clientId: account.clientId,
        socialAccountId: account.id,
      })
      setConfirmOpen(false)
      // Le résultat est LU : une révocation ratée laisse le token vivant, et
      // annoncer un succès serait le mensonge que P8-2 corrige.
      if (!res.ok) {
        toast.error(t("settings.accounts.detachError"))
        return
      }
      toast.success(t("settings.accounts.detached"))
      router.refresh()
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
        {needsAttention && reconnectHref ? (
          <Button size="sm" variant="outline" render={<a href={reconnectHref} />}>
            <RefreshCw />
            {t("settings.accounts.reconnect")}
          </Button>
        ) : null}
        {détaché ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            aria-label={t("settings.accounts.detach")}
          >
            <Link2Off />
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.accounts.detach")}</DialogTitle>
            <DialogDescription>
              {t("settings.accounts.detachConfirm", {
                platform: platformLabel,
                username: account.username,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={détacher}>
              {t("settings.accounts.detach")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
