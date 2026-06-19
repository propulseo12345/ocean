"use client"

import { Eye, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { pick, useLocale, useT } from "@/lib/i18n"
import type { CalendarAccount } from "@/lib/mocks/types"
import { CalendarProviderIcon, useCalendarProviderLabel } from "./calendar-provider-icon"

export function CalendarsTab({ accounts }: { accounts: CalendarAccount[] }) {
  const t = useT()

  function handleConnect() {
    toast.info(
      t("settings.calendars.connectToast", { provider: t("settings.calendars.providerGoogle") }),
      { description: t("settings.calendars.connectToastDescription") }
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Eye />
        <AlertTitle>{t("settings.calendars.readOnlyTitle")}</AlertTitle>
        <AlertDescription>{t("settings.calendars.readOnlyDescription")}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="px-0">
          <ul className="divide-y">
            {accounts.map((account) => (
              <CalendarRow key={account.id} account={account} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={handleConnect}>
        <Plus />
        {t("settings.calendars.connect")}
      </Button>
    </div>
  )
}

function CalendarRow({ account }: { account: CalendarAccount }) {
  const t = useT()
  const { locale } = useLocale()
  const providerLabel = useCalendarProviderLabel()
  const needsAttention = account.status !== "connected"

  function handleReconnect() {
    toast.warning(
      t("settings.calendars.reconnectToast", { provider: providerLabel(account.provider) }),
      { description: t("settings.calendars.reconnectToastDescription") }
    )
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <CalendarProviderIcon provider={account.provider} className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pick(account.label, locale)}</p>
        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} className="hidden sm:inline-flex" />
        {needsAttention ? (
          <Button size="sm" variant="outline" onClick={handleReconnect}>
            <RefreshCw />
            {t("settings.calendars.reconnect")}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
