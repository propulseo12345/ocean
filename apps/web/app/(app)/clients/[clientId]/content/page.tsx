import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { QuotaRow } from "@/components/app/studio/board-types"
import { ContentBoard } from "@/components/app/studio/content-board"
import { getT } from "@/lib/i18n/server"
import {
  getClient,
  getContentItems,
  getPillars,
  getQuotaUsage,
  getReviewer,
  getReviewRequest,
  getSavedViews,
  getSocialAccounts,
} from "@/lib/mocks"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaContentBoard") }
}

export default async function ClientContentPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client) notFound()

  const items = getContentItems(clientId)
  const quotas: QuotaRow[] = getSocialAccounts(clientId).flatMap((account) => {
    const usage = getQuotaUsage(account.id)
    return usage ? [{ account, usage }] : []
  })

  return (
    <ContentBoard
      client={client}
      items={items}
      savedViews={getSavedViews(clientId)}
      reviewer={getReviewer(clientId) ?? null}
      reviewRequest={getReviewRequest(clientId) ?? null}
      quotas={quotas}
      pillars={getPillars(clientId)}
    />
  )
}
