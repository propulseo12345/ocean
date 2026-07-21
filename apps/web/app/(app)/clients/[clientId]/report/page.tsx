import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getReportData } from "@/components/app/performance/report-data"
import { ReportWorkspace } from "@/components/app/performance/report-workspace"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClient } from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaReport") }
}

// Rapport client brandé partageable (audit §5, P1) — one-pager présentable,
// imprimable en PDF. Données mockées d'illustration, aucune API réelle.

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client || client.archivedAt) notFound()

  const data = await getReportData(ctx.org.id, clientId)
  if (!data) notFound()

  return <ReportWorkspace data={data} />
}
