import type { Locale, MessageKey } from "@/lib/i18n"
import { useLocale, useT } from "@/lib/i18n"
import type { KpiWithDelta } from "./perf-data"
import { compactNumber, fullNumber, percent, signedPercent } from "./perf-utils"

interface Stat {
  key: keyof KpiWithDelta["current"]
  labelKey: MessageKey
  format: (n: number, locale: Locale) => string
}

const STATS: Stat[] = [
  { key: "reach", labelKey: "report.kpi.reach", format: compactNumber },
  { key: "engagement", labelKey: "report.kpi.engagement", format: compactNumber },
  { key: "rate", labelKey: "report.kpi.rate", format: (n, locale) => percent(n, locale) },
  { key: "count", labelKey: "report.kpi.count", format: (n, locale) => fullNumber(n, locale) },
]

export function ReportKpis({ data }: { data: KpiWithDelta }) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map((s) => {
        const delta = data.delta ? data.delta[s.key] : null
        return (
          <div key={s.key} className="rounded-xl border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-semibold leading-none tabular-nums">
              {s.format(data.current[s.key], locale)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{t(s.labelKey)}</p>
            {delta !== null ? (
              <p
                className={`mt-1 text-xs font-medium tabular-nums ${
                  delta >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {t("report.kpi.vsPreviousMonth", { delta: signedPercent(delta, locale) })}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">—</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
