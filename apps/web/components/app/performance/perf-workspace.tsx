"use client"

import { FileText, Info } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { PerfBestTimes } from "./perf-best-times"
import { PERIOD_META } from "./perf-core"
import type { PerfPeriod, PerfPeriodData } from "./perf-data"
import { PerfKpis } from "./perf-kpis"
import { PerfPillarSplit } from "./perf-pillar-split"
import { PerfPlatformTable } from "./perf-platform-table"
import { PerfTopPosts } from "./perf-top-posts"
import { PerfTrendChart } from "./perf-trend-chart"

const PERIODS: PerfPeriod[] = ["30d", "month", "90d"]
const SHORT_KEY: Record<
  PerfPeriod,
  "performance.period.short30d" | "performance.period.shortMonth" | "performance.period.short90d"
> = {
  "30d": "performance.period.short30d",
  month: "performance.period.shortMonth",
  "90d": "performance.period.short90d",
}

export function PerfWorkspace({
  clientId,
  byPeriod,
}: {
  clientId: string
  byPeriod: Record<PerfPeriod, PerfPeriodData>
}) {
  const t = useT()
  const [period, setPeriod] = useState<PerfPeriod>("30d")
  const data = byPeriod[period]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">{t("performance.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("performance.subtitle")}</p>
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
            aria-label={t("performance.periodAriaLabel")}
          >
            {PERIODS.map((p) => (
              <ToggleGroupItem key={p} value={p} aria-label={t(PERIOD_META[p].labelKey)}>
                {t(SHORT_KEY[p])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button size="sm" render={<Link href={routes.clientReport(clientId)} />}>
            <FileText />
            {t("performance.generateReport")}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        <p>{t("performance.mockNotice")}</p>
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
