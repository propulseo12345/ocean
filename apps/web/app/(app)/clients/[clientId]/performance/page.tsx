import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllPerfData } from "@/components/app/performance/perf-data"
import { PerfWorkspace } from "@/components/app/performance/perf-workspace"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClient } from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaPerformance") }
}

// Page Performance par client (audit §5, P1) — données mockées d'illustration,
// pré-calculées pour les trois périodes côté serveur. Aucune API réelle :
// Standard Access Meta limite les insights et TikTok brouillon n'en fournit pas.

export default async function ClientPerformancePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client || client.archivedAt) notFound()

  const byPeriod = await getAllPerfData(ctx.org.id, clientId, client.timezone)

  return <PerfWorkspace clientId={clientId} byPeriod={byPeriod} />
}
