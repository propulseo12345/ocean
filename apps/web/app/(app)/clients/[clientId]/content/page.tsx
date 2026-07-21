import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { QuotaRow } from "@/components/app/studio/board-types"
import { ContentBoard } from "@/components/app/studio/content-board"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getClient,
  getContentItems,
  getPillars,
  getQuotaUsage,
  getReviewer,
  getReviewRequest,
  getSavedViews,
  getSocialAccounts,
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"

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
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client) notFound()

  const items = await getContentItems(ctx.org.id, clientId)
  const accounts = await getSocialAccounts(ctx.org.id, clientId)
  const quotas: QuotaRow[] = []
  for (const account of accounts) {
    const usage = await getQuotaUsage(ctx.org.id, account.id)
    if (usage) quotas.push({ account, usage })
  }

  return (
    <ContentBoard
      client={client}
      items={items}
      savedViews={await getSavedViews(ctx.org.id, clientId)}
      reviewer={(await getReviewer(ctx.org.id, clientId)) ?? null}
      reviewRequest={(await getReviewRequest(ctx.org.id, clientId)) ?? null}
      quotas={quotas}
      pillars={await getPillars(ctx.org.id, clientId)}
    />
  )
}
