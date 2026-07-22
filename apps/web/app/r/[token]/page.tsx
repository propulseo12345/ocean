import { createHash } from "node:crypto"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import type { ReportData } from "@/components/app/performance/report-data"
import { ReportWorkspace } from "@/components/app/performance/report-workspace"
import { createClient } from "@/lib/supabase/server"

// Lien PUBLIC d'un rapport client (lecture seule). Aucune session : on lit le
// snapshot fige via la RPC SECURITY DEFINER get_report_share(token_hash) — la
// seule surface exposee au viewer anonyme (migration 018). Route sous le root
// layout (pas de chrome app), rendue dynamiquement.

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Rapport", robots: { index: false } }

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const tokenHash = createHash("sha256").update(token).digest("hex")

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_report_share", { _token_hash: tokenHash })
  if (error || !data) notFound()

  const report = data as unknown as ReportData

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8">
      <ReportWorkspace data={report} readOnly />
    </main>
  )
}
