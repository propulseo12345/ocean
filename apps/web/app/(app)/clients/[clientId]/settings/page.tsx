import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SettingsShell } from "@/components/app/client-settings/settings-shell"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getBrandKit,
  getClient,
  getPillars,
  getRecurringSlots,
  getReviewer,
  getSocialAccounts,
  getTrashedContent,
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaSettings") }
}

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client || client.archivedAt) notFound()
  const reviewer = await getReviewer(ctx.org.id, clientId)

  return (
    <SettingsShell
      client={client}
      accounts={await getSocialAccounts(ctx.org.id, clientId)}
      brandKit={await getBrandKit(ctx.org.id, clientId)}
      reviewer={reviewer ?? undefined}
      slots={await getRecurringSlots(ctx.org.id, clientId)}
      pillars={await getPillars(ctx.org.id, clientId)}
      trashed={await getTrashedContent(ctx.org.id, clientId)}
    />
  )
}
