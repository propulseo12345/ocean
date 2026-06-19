"use client"

import { FileText, Info } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { routes } from "@/lib/routes"
import { PerfBestTimes } from "./perf-best-times"
import type { PerfPeriod, PerfPeriodData } from "./perf-data"
import { PERIOD_META } from "./perf-data"
import { PerfKpis } from "./perf-kpis"
import { PerfPillarSplit } from "./perf-pillar-split"
import { PerfPlatformTable } from "./perf-platform-table"
import { PerfTopPosts } from "./perf-top-posts"
import { PerfTrendChart } from "./perf-trend-chart"

const PERIODS: PerfPeriod[] = ["30d", "month", "90d"]
const SHORT_LABEL: Record<PerfPeriod, string> = {
  "30d": "30 j",
  month: "Mois en cours",
  "90d": "90 j",
}

export function PerfWorkspace({
  clientId,
  byPeriod,
}: {
  clientId: string
  byPeriod: Record<PerfPeriod, PerfPeriodData>
}) {
  const [period, setPeriod] = useState<PerfPeriod>("30d")
  const data = byPeriod[period]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Performance</h2>
          <p className="text-sm text-muted-foreground">
            Aperçu de l'audience et de l'engagement, par période.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[period]}
            onValueChange={(v) => {
              const next = v[0]
              if (next) setPeriod(next as PerfPeriod)
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Période d'analyse"
          >
            {PERIODS.map((p) => (
              <ToggleGroupItem key={p} value={p} aria-label={PERIOD_META[p].label}>
                {SHORT_LABEL[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button size="sm" render={<Link href={routes.clientReport(clientId)} />}>
            <FileText />
            Générer le rapport client
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        <p>
          Données d'illustration. Les statistiques réelles (portée, engagement, créneaux)
          s'afficheront une fois les comptes connectés — certaines métriques dépendent d'un accès
          avancé Meta, et TikTok en mode brouillon ne fournit aucune statistique via l'API.
        </p>
      </div>

      <PerfKpis data={data.kpis} period={period} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerfTrendChart buckets={data.trend} />
        </div>
        <PerfPillarSplit pillars={data.pillars} />
      </div>

      <PerfTopPosts posts={data.posts} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PerfPlatformTable rows={data.platforms} />
        <PerfBestTimes />
      </div>
    </div>
  )
}
