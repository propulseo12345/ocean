"use client"

import { Eye, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CalendarAccount } from "@/lib/mocks/types"
import { CalendarProviderIcon, calendarProviderLabel } from "./calendar-provider-icon"

export function CalendarsTab({ accounts }: { accounts: CalendarAccount[] }) {
  return (
    <div className="space-y-4">
      <Alert>
        <Eye />
        <AlertTitle>Connexion en lecture seule</AlertTitle>
        <AlertDescription>
          Ocean lit tes événements pour composer l'agenda unifié (Google + Outlook) dans ton fuseau.
          Aucun rendez-vous n'est créé ni modifié sur tes calendriers.
        </AlertDescription>
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

      <Button variant="outline" onClick={() => connectToast("Google")}>
        <Plus />
        Connecter un calendrier
      </Button>
    </div>
  )
}

function connectToast(provider: string) {
  toast.info(`Connexion ${provider}`, {
    description: "Action simulée (preview) — l'autorisation s'ouvrira ici.",
  })
}

function CalendarRow({ account }: { account: CalendarAccount }) {
  const needsAttention = account.status !== "connected"
  const providerLabel = calendarProviderLabel[account.provider]

  function handleReconnect() {
    toast.warning(`Reconnexion ${providerLabel}`, {
      description: "Action simulée (preview) — l'autorisation s'ouvrira ici.",
    })
  }

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
          <Button size="sm" variant="outline" onClick={handleReconnect}>
            <RefreshCw />
            Reconnecter
          </Button>
        ) : null}
      </div>
    </li>
  )
}
