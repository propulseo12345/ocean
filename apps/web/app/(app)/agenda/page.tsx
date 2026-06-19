import type { Metadata } from "next"
import { UnifiedAgenda } from "@/components/app/agenda/unified-agenda"
import { PageHeader } from "@/components/shared/page-header"
import { CALENDAR_ACCOUNTS, CURRENT_USER, getCalendarEvents, getUnifiedAgenda } from "@/lib/mocks"

export const metadata: Metadata = { title: "Agenda unifié" }

export default function AgendaPage() {
  const agenda = getUnifiedAgenda()
  const accounts = CALENDAR_ACCOUNTS
  const events = getCalendarEvents()
  const tz = CURRENT_USER.timezone

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda unifié"
        description="Tes rendez-vous Google et Outlook superposés aux publications de tous tes clients — dans ton fuseau."
      />
      <UnifiedAgenda agenda={agenda} accounts={accounts} events={events} tz={tz} />
    </div>
  )
}
