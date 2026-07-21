import type { Metadata } from "next"
import type { ClientAccountsGroup } from "@/components/app/settings/accounts-tab"
import { SettingsTabs } from "@/components/app/settings/settings-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getCalendarAccounts, getClients, getCurrentUser, getSocialAccounts } from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.settingsTitle") }
}

export default async function SettingsAccountsPage() {
  const t = await getT()
  const ctx = await getActiveOrg()
  const clients = await getClients(ctx.org.id)
  const groups: ClientAccountsGroup[] = (
    await Promise.all(
      clients.map(async (client) => ({
        client,
        accounts: await getSocialAccounts(ctx.org.id, client.id),
      }))
    )
  ).filter((g) => g.accounts.length > 0)
  const calendars = await getCalendarAccounts(ctx.org.id)
  const user = await getCurrentUser()

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
        calendars={calendars}
        user={user}
      />
    </div>
  )
}
