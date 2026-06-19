import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EditorialCalendar } from "@/components/app/calendar/editorial-calendar"
import {
  getClient,
  getClientEvents,
  getClients,
  getContentItems,
  getPillars,
  getQuotaUsage,
  getReviewer,
  getReviewRequest,
  getSocialAccounts,
} from "@/lib/mocks"

export const metadata: Metadata = { title: "Calendrier éditorial" }

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client) notFound()

  // Tous les contenus actifs : les non datés alimentent l'étagère « À planifier ».
  const items = getContentItems(clientId)
  const accounts = getSocialAccounts(clientId)
  const igAccount = accounts.find((a) => a.platform === "instagram")

  return (
    <EditorialCalendar
      client={client}
      clients={getClients()}
      items={items}
      accounts={accounts}
      pillars={getPillars(clientId)}
      events={getClientEvents(clientId)}
      reviewerName={getReviewer(clientId)?.name ?? null}
      reviewSentAt={getReviewRequest(clientId)?.sentAt ?? null}
      igQuota={igAccount ? getQuotaUsage(igAccount.id) : null}
    />
  )
}
