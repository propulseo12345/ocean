import type { Metadata } from "next"
import type { ClientAccountsGroup } from "@/components/app/settings/accounts-tab"
import { SettingsTabs } from "@/components/app/settings/settings-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { getT } from "@/lib/i18n/server"
import { CALENDAR_ACCOUNTS, CURRENT_USER, getClients, getSocialAccounts } from "@/lib/mocks"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.settingsTitle") }
}

export default async function SettingsAccountsPage() {
  const t = await getT()
  const groups: ClientAccountsGroup[] = getClients()
    .map((client) => ({ client, accounts: getSocialAccounts(client.id) }))
    .filter((g) => g.accounts.length > 0)

  const needsAttentionCount = groups
    .flatMap((g) => g.accounts)
    .filter((a) => a.status !== "connected").length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.settingsTitle")}
        description={t("clients.settingsDescription")}
      />

      <SettingsTabs
        groups={groups}
        needsAttentionCount={needsAttentionCount}
        calendars={CALENDAR_ACCOUNTS}
        user={CURRENT_USER}
      />
    </div>
  )
}
