import { ArrowLeft, Lock } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { type ComposerData, ComposerScreen } from "@/components/app/studio/composer/composer-screen"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pick } from "@/lib/i18n"
import { getLocale, getT } from "@/lib/i18n/server"
import {
  getBrandKit,
  getClient,
  getContentItem,
  getHashtagGroups,
  getLibraryAssets,
  getPillars,
  getQuotaUsage,
  getRecurringSlots,
  getSocialAccounts,
} from "@/lib/mocks"
import type { ContentStatus, QuotaUsage } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaContentEdit") }
}

// Lecture seule à partir de la publication (règle d'éditabilité PRD §5.B).
const READ_ONLY: ContentStatus[] = ["publishing", "published", "partially_published"]

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ clientId: string; contentId: string }>
}) {
  const { clientId, contentId } = await params
  const client = getClient(clientId)
  const content = getContentItem(contentId)
  if (!client || !content || content.clientId !== clientId) notFound()

  if (READ_ONLY.includes(content.status)) {
    const t = await getT()
    const locale = await getLocale()
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link href={routes.content(clientId, contentId)} />}
        >
          <ArrowLeft />
          {t("clients.backToContent")}
        </Button>
        <Alert>
          <Lock />
          <AlertTitle>{t("clients.readOnlyTitle")}</AlertTitle>
          <AlertDescription>
            {t("clients.readOnlyDescription", { title: pick(content.title, locale) })}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

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

  return <ComposerScreen data={data} initialContent={content} />
}
