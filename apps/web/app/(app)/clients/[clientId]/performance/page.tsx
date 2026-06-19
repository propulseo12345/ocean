import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllPerfData } from "@/components/app/performance/perf-data"
import { PerfWorkspace } from "@/components/app/performance/perf-workspace"
import { getClient } from "@/lib/mocks"

export const metadata: Metadata = { title: "Performance" }

// Page Performance par client (audit §5, P1) — données mockées d'illustration,
// pré-calculées pour les trois périodes côté serveur. Aucune API réelle :
// Standard Access Meta limite les insights et TikTok brouillon n'en fournit pas.

export default async function ClientPerformancePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client || client.archivedAt) notFound()

  const byPeriod = getAllPerfData(clientId, client.timezone)

  return <PerfWorkspace clientId={clientId} byPeriod={byPeriod} />
}
