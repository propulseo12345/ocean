import { Clock, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { bestSlotLabel, HEAT_HOURS, heatIntensity, WEEKDAYS_FR } from "./perf-utils"

// Heatmap jour × heure (estimation mockée). Intensité = opacité d'un token de
// thème — clairement étiquetée comme estimation, jamais comme donnée API.

export function PerfBestTimes() {
  const best = bestSlotLabel()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          Meilleurs créneaux
        </CardTitle>
        <CardDescription>
          Estimation à partir de l'historique de publication — meilleur créneau estimé :{" "}
          <span className="font-medium text-foreground">{best}</span>.
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
                {h}h
              </span>
            ))}
            {WEEKDAYS_FR.map((day, d) => (
              <div key={day} className="contents">
                <span className="flex items-center text-[11px] text-muted-foreground">{day}</span>
                {HEAT_HOURS.map((h, hi) => {
                  const v = heatIntensity(d, hi)
                  return (
                    <span
                      key={h}
                      className="aspect-square rounded-sm bg-primary"
                      style={{ opacity: 0.12 + v * 0.78 }}
                      title={`${day}. ${h}h — affinité estimée ${Math.round(v * 100)} %`}
                    >
                      <span className="sr-only">
                        {day} {h}h, affinité {Math.round(v * 100)} %
                      </span>
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-px size-3 shrink-0" />
          Indicatif : aucune API ne garantit ces créneaux. Affinez avec les retours réels du compte
          une fois les statistiques connectées.
        </p>
      </CardContent>
    </Card>
  )
}
