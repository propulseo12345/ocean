"use client"

import { Check, Link2, Unplug } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Platform } from "@/lib/domain"
import { type MessageKey, useLabels, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { DraftSocialAccount } from "./wizard-types"

// Note honnête par plateforme (contraintes réelles d'intégration).
const PLATFORM_NOTE_KEYS: Record<Platform, MessageKey | undefined> = {
  instagram: "onboarding.accountCard.noteInstagram",
  facebook: "onboarding.accountCard.noteFacebook",
  tiktok: "onboarding.accountCard.noteTiktok",
  newsletter: undefined,
  custom: undefined,
}

export function AccountConnectCard({
  account,
  onChange,
}: {
  account: DraftSocialAccount
  onChange: (next: DraftSocialAccount) => void
}) {
  const t = useT()
  const lbl = useLabels()
  const platformLabel = lbl.platform(account.platform)
  const noteKey = PLATFORM_NOTE_KEYS[account.platform]
  const [username, setUsername] = useState(account.username)

  function connect() {
    const handle = username.trim().replace(/^@+/, "")
    if (!handle) {
      toast.warning(t("onboarding.accountCard.usernameRequired"))
      return
    }
    toast.info(t("onboarding.accountCard.oauthRedirect", { platform: platformLabel }), {
      description: t("onboarding.accountCard.oauthRedirectHint"),
    })
    onChange({ ...account, username: handle, connected: true })
  }

  function disconnect() {
    onChange({ ...account, connected: false })
    toast.info(t("onboarding.accountCard.disconnected", { platform: platformLabel }))
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        account.connected ? "border-success/40 bg-success/5" : "bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <PlatformIcon platform={account.platform} className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {platformLabel}
            {account.connected ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" />
                {t("onboarding.accountCard.connected")}
              </span>
            ) : null}
          </p>
          {noteKey ? <p className="mt-0.5 text-xs text-muted-foreground">{t(noteKey)}</p> : null}
        </div>
      </div>

      {account.connected ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2">
          <span className="truncate text-sm">@{account.username}</span>
          <Button type="button" variant="ghost" size="sm" onClick={disconnect}>
            <Unplug />
            {t("onboarding.accountCard.disconnect")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`acc-${account.platform}`} className="text-xs text-muted-foreground">
            {t("onboarding.accountCard.usernameLabel")}
          </Label>
          <div className="flex gap-2">
            <Input
              id={`acc-${account.platform}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                account.platform === "tiktok"
                  ? t("onboarding.accountCard.usernamePlaceholderTiktok")
                  : t("onboarding.accountCard.usernamePlaceholder")
              }
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={connect}>
              <Link2 />
              {t("onboarding.accountCard.connect")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
