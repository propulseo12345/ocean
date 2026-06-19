import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getReportData } from "@/components/app/performance/report-data"
import { ReportWorkspace } from "@/components/app/performance/report-workspace"
import { getClient } from "@/lib/mocks"

export const metadata: Metadata = { title: "Rapport client" }

// Rapport client brandé partageable (audit §5, P1) — one-pager présentable,
// imprimable en PDF. Données mockées d'illustration, aucune API réelle.

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client || client.archivedAt) notFound()

  const data = getReportData(clientId)
  if (!data) notFound()

  return <ReportWorkspace data={data} />
}
