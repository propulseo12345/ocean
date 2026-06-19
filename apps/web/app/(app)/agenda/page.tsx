import type { Metadata } from "next"
import { UnifiedAgenda } from "@/components/app/agenda/unified-agenda"
import { PageHeader } from "@/components/shared/page-header"
import { getT } from "@/lib/i18n/server"
import { CALENDAR_ACCOUNTS, CURRENT_USER, getCalendarEvents, getUnifiedAgenda } from "@/lib/mocks"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("agenda.metaTitle") }
}

export default async function AgendaPage() {
  const t = await getT()
  const agenda = getUnifiedAgenda()
  const accounts = CALENDAR_ACCOUNTS
  const events = getCalendarEvents()
  const tz = CURRENT_USER.timezone

  return (
    <div className="space-y-6">
      <PageHeader title={t("agenda.pageTitle")} description={t("agenda.pageDescription")} />
      <UnifiedAgenda agenda={agenda} accounts={accounts} events={events} tz={tz} />
    </div>
  )
}
