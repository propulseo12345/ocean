"use client"

import { Link2Off, TriangleAlert } from "lucide-react"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Client, SocialAccount } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { AccountRow } from "./account-row"
import { ConnectAccountMenu } from "./connect-account-menu"

export interface ClientAccountsGroup {
  client: Client
  accounts: SocialAccount[]
}

export function AccountsTab({
  groups,
  needsAttentionCount,
}: {
  groups: ClientAccountsGroup[]
  needsAttentionCount: number
}) {
  const t = useT()

  // Aucun client : rien à connecter tant qu'un espace client n'existe pas.
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Link2Off}
        title={t("settings.accounts.emptyTitle")}
        description={t("settings.accounts.emptyDescription")}
      />
    )
  }

  return (
    <div className="space-y-4">
      {needsAttentionCount > 0 ? (
        <Alert className="text-warning">
          <TriangleAlert />
          <AlertTitle>
            {t("settings.accounts.needsAttention", { count: needsAttentionCount })}
          </AlertTitle>
          <AlertDescription>{t("settings.accounts.healthDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {groups.map(({ client, accounts }) => (
        <Card key={client.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
            <CardTitle className="flex min-w-0 items-center gap-2.5 text-sm">
              <ClientAvatar client={client} size={28} />
              <span className="truncate">{client.name}</span>
            </CardTitle>
            <ConnectAccountMenu clientId={client.id} />
          </CardHeader>
          <CardContent className="px-0">
            {accounts.length > 0 ? (
              <ul className="divide-y">
                {accounts.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground sm:px-4">
                {t("settings.accounts.noAccountForClient")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
