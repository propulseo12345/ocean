"use client"

import { Eye, Plus, RefreshCw } from "lucide-react"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CalendarAccount, CalendarProvider } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { CalendarProviderIcon, useCalendarProviderLabel } from "./calendar-provider-icon"

// Les agendas sont scopés par utilisateur (calendar_accounts.user_id). La
// connexion/reconnexion relance le flux OAuth Google/Microsoft — navigation
// pleine page vers /api/oauth/<provider> (pas de clientId : agenda org/user-level).
const CALENDAR_PROVIDERS: CalendarProvider[] = ["google", "microsoft"]

export function CalendarsTab({ accounts }: { accounts: CalendarAccount[] }) {
  const t = useT()
  const providerLabel = useCalendarProviderLabel()

  return (
    <div className="space-y-4">
      <Alert>
        <Eye />
        <AlertTitle>{t("settings.calendars.readOnlyTitle")}</AlertTitle>
        <AlertDescription>{t("settings.calendars.readOnlyDescription")}</AlertDescription>
      </Alert>

      {accounts.length > 0 ? (
        <Card>
          <CardContent className="px-0">
            <ul className="divide-y">
              {accounts.map((account) => (
                <CalendarRow key={account.id} account={account} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <Plus />
          {t("settings.calendars.connect")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {CALENDAR_PROVIDERS.map((provider) => (
            <DropdownMenuItem key={provider} render={<a href={`/api/oauth/${provider}`} />}>
              <CalendarProviderIcon provider={provider} className="size-4" />
              {providerLabel(provider)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function CalendarRow({ account }: { account: CalendarAccount }) {
  const t = useT()
  const needsAttention = account.status !== "connected"

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <CalendarProviderIcon provider={account.provider} className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{account.label}</p>
        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} className="hidden sm:inline-flex" />
        {needsAttention ? (
          <Button
            size="sm"
            variant="outline"
            render={<a href={`/api/oauth/${account.provider}`} />}
          >
            <RefreshCw />
            {t("settings.calendars.reconnect")}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
