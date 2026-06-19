import { Eye, FileStack, Heart, type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KpiWithDelta, PerfPeriod } from "./perf-data"
import { PERIOD_META } from "./perf-data"
import { compactNumber, fullNumber, percent, signedPercent } from "./perf-utils"

interface KpiDef {
  key: keyof KpiWithDelta["current"]
  label: string
  icon: LucideIcon
  /** true → une hausse est positive (vert) ; false → une baisse est positive. */
  upIsGood: boolean
  format: (n: number) => string
}

const KPIS: KpiDef[] = [
  { key: "reach", label: "Portée totale", icon: Eye, upIsGood: true, format: compactNumber },
  { key: "engagement", label: "Engagements", icon: Heart, upIsGood: true, format: compactNumber },
  {
    key: "rate",
    label: "Taux d'engagement",
    icon: TrendingUp,
    upIsGood: true,
    format: (n) => percent(n),
  },
  {
    key: "count",
    label: "Publications",
    icon: FileStack,
    upIsGood: true,
    format: (n) => fullNumber(n),
  },
]

function DeltaPill({ value, upIsGood }: { value: number; upIsGood: boolean }) {
  const positive = upIsGood ? value >= 0 : value <= 0
  const Icon = value >= 0 ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3" />
      {signedPercent(value)}
    </span>
  )
}

export function PerfKpis({ data, period }: { data: KpiWithDelta; period: PerfPeriod }) {
  const prev = PERIOD_META[period].previous
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {KPIS.map((kpi) => {
        const value = data.current[kpi.key]
        const delta = data.delta[kpi.key]
        return (
          <div
            key={kpi.key}
            className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <kpi.icon className="size-4.5" />
              </span>
              <DeltaPill value={delta} upIsGood={kpi.upIsGood} />
            </div>
            <p className="mt-3 font-heading text-2xl font-semibold leading-none tabular-nums">
              {kpi.format(value)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">vs {prev}</p>
          </div>
        )
      })}
    </div>
  )
}
