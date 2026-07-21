import type { Metadata } from "next"
import { UnifiedAgenda } from "@/components/app/agenda/unified-agenda"
import { PageHeader } from "@/components/shared/page-header"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getCalendarAccounts,
  getCalendarEvents,
  getCurrentUser,
  getUnifiedAgenda,
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("agenda.metaTitle") }
}

export default async function AgendaPage() {
  const t = await getT()
  const ctx = await getActiveOrg()
  const agenda = await getUnifiedAgenda(ctx.org.id)
  const accounts = await getCalendarAccounts(ctx.org.id)
  const events = await getCalendarEvents(ctx.org.id)
  const user = await getCurrentUser()
  const tz = user.timezone

  return (
    <div className="space-y-6">
      <PageHeader title={t("agenda.pageTitle")} description={t("agenda.pageDescription")} />
      <UnifiedAgenda agenda={agenda} accounts={accounts} events={events} tz={tz} />
    </div>
  )
}
