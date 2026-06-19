import type { KpiWithDelta } from "./perf-data"
import { compactNumber, fullNumber, percent, signedPercent } from "./perf-utils"

interface Stat {
  key: keyof KpiWithDelta["current"]
  label: string
  format: (n: number) => string
}

const STATS: Stat[] = [
  { key: "reach", label: "Portée", format: compactNumber },
  { key: "engagement", label: "Engagements", format: compactNumber },
  { key: "rate", label: "Taux d'engagement", format: (n) => percent(n) },
  { key: "count", label: "Publications", format: (n) => fullNumber(n) },
]

export function ReportKpis({ data }: { data: KpiWithDelta }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map((s) => {
        const delta = data.delta[s.key]
        const positive = delta >= 0
        return (
          <div key={s.key} className="rounded-xl border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-semibold leading-none tabular-nums">
              {s.format(data.current[s.key])}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
            <p
              className={`mt-1 text-xs font-medium tabular-nums ${
                positive ? "text-success" : "text-destructive"
              }`}
            >
              {signedPercent(delta)} vs mois précédent
            </p>
          </div>
        )
      })}
    </div>
  )
}
