import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EditorialCalendar } from "@/components/app/calendar/editorial-calendar"
import { getActiveOrg } from "@/lib/auth/org-context"
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
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaCalendar") }
}

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client) notFound()

  const items = await getContentItems(ctx.org.id, clientId)
  const accounts = await getSocialAccounts(ctx.org.id, clientId)
  const igAccount = accounts.find((a) => a.platform === "instagram")
  const reviewer = await getReviewer(ctx.org.id, clientId)
  const reviewRequest = await getReviewRequest(ctx.org.id, clientId)

  return (
    <EditorialCalendar
      client={client}
      clients={await getClients(ctx.org.id)}
      items={items}
      accounts={accounts}
      pillars={await getPillars(ctx.org.id, clientId)}
      events={await getClientEvents(ctx.org.id, clientId)}
      reviewerName={reviewer?.name ?? null}
      reviewSentAt={reviewRequest?.sentAt ?? null}
      igQuota={igAccount ? await getQuotaUsage(ctx.org.id, igAccount.id) : null}
    />
  )
}
