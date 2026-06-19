import { Eye, FileStack, Heart, type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import type { Locale, MessageKey } from "@/lib/i18n"
import { useLocale, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { KpiWithDelta, PerfPeriod } from "./perf-data"
import { PERIOD_META } from "./perf-data"
import { compactNumber, fullNumber, percent, signedPercent } from "./perf-utils"

interface KpiDef {
  key: keyof KpiWithDelta["current"]
  labelKey: MessageKey
  icon: LucideIcon
  /** true → une hausse est positive (vert) ; false → une baisse est positive. */
  upIsGood: boolean
  format: (n: number, locale: Locale) => string
}

const KPIS: KpiDef[] = [
  {
    key: "reach",
    labelKey: "performance.kpi.reach",
    icon: Eye,
    upIsGood: true,
    format: compactNumber,
  },
  {
    key: "engagement",
    labelKey: "performance.kpi.engagement",
    icon: Heart,
    upIsGood: true,
    format: compactNumber,
  },
  {
    key: "rate",
    labelKey: "performance.kpi.rate",
    icon: TrendingUp,
    upIsGood: true,
    format: (n, locale) => percent(n, locale),
  },
  {
    key: "count",
    labelKey: "performance.kpi.count",
    icon: FileStack,
    upIsGood: true,
    format: (n, locale) => fullNumber(n, locale),
  },
]

function DeltaPill({ value, upIsGood }: { value: number; upIsGood: boolean }) {
  const { locale } = useLocale()
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
      {signedPercent(value, locale)}
    </span>
  )
}

export function PerfKpis({ data, period }: { data: KpiWithDelta; period: PerfPeriod }) {
  const t = useT()
  const { locale } = useLocale()
  const prev = t(PERIOD_META[period].previousKey)
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
              {kpi.format(value, locale)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{t(kpi.labelKey)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              {t("performance.kpi.vsPrevious", { previous: prev })}
            </p>
          </div>
        )
      })}
    </div>
  )
}
