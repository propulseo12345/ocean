import { Clock, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import { bestSlot, HEAT_HOURS, heatIntensity, WEEKDAY_KEYS } from "./perf-utils"

// Heatmap jour × heure (estimation mockée). Intensité = opacité d'un token de
// thème — clairement étiquetée comme estimation, jamais comme donnée API.

export function PerfBestTimes() {
  const t = useT()
  const best = bestSlot()
  const days = WEEKDAY_KEYS.map((k) => t(k))
  const bestLabel = t("performance.bestTimes.slotLabel", {
    day: days[best.dayIdx],
    hour: best.hour,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          {t("performance.bestTimes.title")}
        </CardTitle>
        <CardDescription>
          {t("performance.bestTimes.description")}
          <span className="font-medium text-foreground">{bestLabel}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[20rem] gap-1"
            style={{ gridTemplateColumns: `2.5rem repeat(${HEAT_HOURS.length}, minmax(0, 1fr))` }}
          >
            <span aria-hidden />
            {HEAT_HOURS.map((h) => (
              <span key={h} className="text-center text-[11px] text-muted-foreground tabular-nums">
                {t("performance.bestTimes.hour", { hour: h })}
              </span>
            ))}
            {WEEKDAY_KEYS.map((dayKey, d) => {
              const day = days[d]
              return (
                <div key={dayKey} className="contents">
                  <span className="flex items-center text-[11px] text-muted-foreground">{day}</span>
                  {HEAT_HOURS.map((h, hi) => {
                    const v = heatIntensity(d, hi)
                    const affinity = Math.round(v * 100)
                    return (
                      <span
                        key={h}
                        className="aspect-square rounded-sm bg-primary"
                        style={{ opacity: 0.12 + v * 0.78 }}
                        title={t("performance.bestTimes.cellTitle", { day, hour: h, affinity })}
                      >
                        <span className="sr-only">
                          {t("performance.bestTimes.cellSr", { day, hour: h, affinity })}
                        </span>
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-px size-3 shrink-0" />
          {t("performance.bestTimes.disclaimer")}
        </p>
      </CardContent>
    </Card>
  )
}
