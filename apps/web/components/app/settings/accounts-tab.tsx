"use client"

import { Link2Off, TriangleAlert } from "lucide-react"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import type { Client, SocialAccount } from "@/lib/mocks/types"
import { AccountRow } from "./account-row"

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
  const hasAccounts = groups.some((g) => g.accounts.length > 0)

  if (!hasAccounts) {
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
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <ClientAvatar client={client} size={28} />
              {client.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
