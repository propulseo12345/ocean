import { ArrowLeft, Lock } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { type ComposerData, ComposerScreen } from "@/components/app/studio/composer/composer-screen"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getActiveOrg } from "@/lib/auth/org-context"
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
} from "@/lib/data"
import { pick } from "@/lib/i18n"
import { getLocale, getT } from "@/lib/i18n/server"
import type { ContentStatus, QuotaUsage } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaContentEdit") }
}

const READ_ONLY: ContentStatus[] = ["publishing", "published", "partially_published"]

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ clientId: string; contentId: string }>
}) {
  const { clientId, contentId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  const content = await getContentItem(ctx.org.id, clientId, contentId)
  if (!client || !content) notFound()

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

  return <ComposerScreen data={data} initialContent={content} />
}
