import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TrendBucket } from "./perf-data"
import { compactNumber } from "./perf-utils"

// Graphe de tendance par période en barres CSS (hauteur en %), sans lib de
// charting. Accessible : aria-label global + table sr-only des valeurs.

const SERIES = [
  { key: "reach" as const, label: "Portée", colorVar: "var(--chart-1)" },
  { key: "engagement" as const, label: "Engagements", colorVar: "var(--chart-3)" },
]

export function PerfTrendChart({ buckets }: { buckets: TrendBucket[] }) {
  const maxReach = Math.max(1, ...buckets.map((b) => b.reach))
  const maxEng = Math.max(1, ...buckets.map((b) => b.engagement))
  const maxOf = (key: "reach" | "engagement") => (key === "reach" ? maxReach : maxEng)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution sur la période</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: s.colorVar }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-44 items-end gap-2 sm:gap-3"
          role="img"
          aria-label="Évolution de la portée et des engagements sur la période"
        >
          {buckets.map((b) => (
            <div
              key={b.label}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <div className="flex h-full w-full items-end justify-center gap-1">
                {SERIES.map((s) => {
                  const value = b[s.key]
                  const pct = Math.max(3, Math.round((value / maxOf(s.key)) * 100))
                  return (
                    <div
                      key={s.key}
                      className="w-1/2 max-w-7 rounded-t-sm transition-all"
                      style={{ height: `${pct}%`, backgroundColor: s.colorVar }}
                      title={`${s.label} · ${compactNumber(value)}`}
                    />
                  )
                })}
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{b.label}</span>
            </div>
          ))}
        </div>

        <table className="sr-only">
          <caption>Portée et engagements par intervalle</caption>
          <thead>
            <tr>
              <th>Intervalle</th>
              <th>Portée</th>
              <th>Engagements</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td>{b.reach}</td>
                <td>{b.engagement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
