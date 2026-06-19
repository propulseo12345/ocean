import type { Metadata } from "next"
import type { ClientAccountsGroup } from "@/components/app/settings/accounts-tab"
import { SettingsTabs } from "@/components/app/settings/settings-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { CALENDAR_ACCOUNTS, CURRENT_USER, getClients, getSocialAccounts } from "@/lib/mocks"

export const metadata: Metadata = { title: "Réglages" }

export default function SettingsAccountsPage() {
  const groups: ClientAccountsGroup[] = getClients()
    .map((client) => ({ client, accounts: getSocialAccounts(client.id) }))
    .filter((g) => g.accounts.length > 0)

  const needsAttentionCount = groups
    .flatMap((g) => g.accounts)
    .filter((a) => a.status !== "connected").length

  return (
    <div className="space-y-6">
      <PageHeader title="Réglages" description="Comptes sociaux, agendas connectés et profil." />

      <SettingsTabs
        groups={groups}
        needsAttentionCount={needsAttentionCount}
        calendars={CALENDAR_ACCOUNTS}
        user={CURRENT_USER}
      />
    </div>
  )
}
