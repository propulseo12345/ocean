import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  type ComposerData,
  type ComposerPrefill,
  ComposerScreen,
} from "@/components/app/studio/composer/composer-screen"
import { zonedToUtcIso } from "@/components/app/studio/composer/composer-utils"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getBrandKit,
  getClient,
  getHashtagGroups,
  getLibraryAssets,
  getPillars,
  getQuotaUsage,
  getRecurringSlots,
  getSocialAccounts,
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import type { QuotaUsage } from "@/lib/mocks/types"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaContentNew") }
}

function buildPrefill(
  search: { date?: string; time?: string; media?: string },
  timeZone: string
): ComposerPrefill | undefined {
  const prefill: ComposerPrefill = {}
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(search.date ?? "")
  if (dateMatch) {
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(search.time ?? "")
    const [year, month, day] = dateMatch.slice(1).map(Number)
    const hour = timeMatch ? Number(timeMatch[1]) : 9
    const minute = timeMatch ? Number(timeMatch[2]) : 0
    const inBounds =
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    if (inBounds) {
      prefill.scheduledAt = zonedToUtcIso(year, month, day, hour, minute, timeZone)
    }
  }
  if (search.media) prefill.mediaAssetId = search.media
  return prefill.scheduledAt || prefill.mediaAssetId ? prefill : undefined
}

export default async function NewContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ date?: string; time?: string; media?: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client || client.archivedAt) notFound()

  const accounts = await getSocialAccounts(ctx.org.id, clientId)
  const quotas: Record<string, QuotaUsage | null> = Object.fromEntries(
    await Promise.all(accounts.map(async (a) => [a.id, await getQuotaUsage(ctx.org.id, a.id)]))
  )

  const data: ComposerData = {
    client,
    accounts,
    pillars: await getPillars(ctx.org.id, clientId),
    hashtagGroups: await getHashtagGroups(ctx.org.id, clientId),
    libraryAssets: await getLibraryAssets(ctx.org.id, clientId),
    brandKit: (await getBrandKit(ctx.org.id, clientId)) ?? null,
    recurringSlots: await getRecurringSlots(ctx.org.id, clientId),
    quotas,
  }

  const prefill = buildPrefill(await searchParams, client.timezone)

  return <ComposerScreen data={data} initialContent={null} prefill={prefill} />
}
