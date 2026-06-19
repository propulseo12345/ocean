import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  type ComposerData,
  type ComposerPrefill,
  ComposerScreen,
} from "@/components/app/studio/composer/composer-screen"
import { zonedToUtcIso } from "@/components/app/studio/composer/composer-utils"
import {
  getBrandKit,
  getClient,
  getHashtagGroups,
  getLibraryAssets,
  getPillars,
  getQuotaUsage,
  getRecurringSlots,
  getSocialAccounts,
} from "@/lib/mocks"
import type { QuotaUsage } from "@/lib/mocks/types"

export const metadata: Metadata = { title: "Nouveau contenu" }

// Préremplissage depuis une case de calendrier (?date=AAAA-MM-JJ&time=HH:mm,
// heure murale du client) ou la médiathèque (?media=asset_id).
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
    // Date.UTC normalise les débordements (2026-13-45 → date valide décalée) :
    // on borne explicitement pour ignorer un créneau silencieusement faux.
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
  const client = getClient(clientId)
  if (!client || client.archivedAt) notFound()

  const accounts = getSocialAccounts(clientId)
  const quotas: Record<string, QuotaUsage | null> = Object.fromEntries(
    accounts.map((a) => [a.id, getQuotaUsage(a.id)])
  )

  const data: ComposerData = {
    client,
    accounts,
    pillars: getPillars(clientId),
    hashtagGroups: getHashtagGroups(clientId),
    libraryAssets: getLibraryAssets(clientId),
    brandKit: getBrandKit(clientId) ?? null,
    recurringSlots: getRecurringSlots(clientId),
    quotas,
  }

  const prefill = buildPrefill(await searchParams, client.timezone)

  return <ComposerScreen data={data} initialContent={null} prefill={prefill} />
}
