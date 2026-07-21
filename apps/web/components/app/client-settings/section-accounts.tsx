"use client"

import { ExternalLink, Info, Link2Off, RefreshCw, Waypoints } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { SocialAccount } from "@/lib/domain"
import { type MessageKey, useFormat, useLabels, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { SectionCard } from "./section-card"

// Honnêteté sur les contraintes réelles des plateformes (analyse §2.1).
const PLATFORM_NOTE_KEYS: Partial<Record<SocialAccount["platform"], MessageKey>> = {
  instagram: "clientSettings.accounts.noteInstagram",
  facebook: "clientSettings.accounts.noteFacebook",
  tiktok: "clientSettings.accounts.noteTiktok",
}

export function SectionAccounts({ accounts }: { accounts: SocialAccount[] }) {
  const t = useT()
  return (
    <SectionCard
      icon={Waypoints}
      title={t("clientSettings.accounts.title")}
      description={t("clientSettings.accounts.description")}
      action={
        <Button size="sm" variant="outline" render={<Link href={routes.settings} />}>
          {t("clientSettings.accounts.manage")}
          <ExternalLink />
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <EmptyState
          icon={Link2Off}
          title={t("clientSettings.accounts.emptyTitle")}
          description={t("clientSettings.accounts.emptyDescription")}
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("clientSettings.accounts.healthNote")}
      </p>
    </SectionCard>
  )
}

function AccountRow({ account }: { account: SocialAccount }) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const platformLabel = lbl.platform(account.platform)
  const needsAttention = account.status !== "connected"
  const noteKey = PLATFORM_NOTE_KEYS[account.platform]

  function reconnect() {
    toast.info(t("clientSettings.accounts.reconnectToast", { platform: platformLabel }), {
      description: t("clientSettings.accounts.reconnectToastDescription"),
    })
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <PlatformIcon platform={account.platform} className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {platformLabel}
          <span className="truncate font-normal text-muted-foreground">@{account.username}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t("clientSettings.accounts.followers", { count: f.followers(account.followers) })}
          {noteKey ? <span className="hidden sm:inline"> · {t(noteKey)}</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} />
        {needsAttention ? (
          <Button size="sm" variant="outline" onClick={reconnect}>
            <RefreshCw />
            <span className="hidden sm:inline">{t("clientSettings.accounts.reconnect")}</span>
          </Button>
        ) : null}
      </div>
    </li>
  )
}
