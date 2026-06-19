import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PillarSlice } from "./perf-data"
import { percent } from "./perf-utils"

function ShareBar({
  value,
  target,
  colorVar,
}: {
  value: number
  target: number
  colorVar: string
}) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: colorVar }}
      />
      <span
        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-foreground/45"
        style={{ left: `${Math.min(100, target)}%` }}
        title={`Cible ${percent(target, 0)}`}
        aria-hidden
      />
    </div>
  )
}

export function PerfPillarSplit({ pillars }: { pillars: PillarSlice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par pilier</CardTitle>
        <CardDescription>
          Part des engagements par pilier éditorial — le repère vertical marque la cible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pillars.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2 truncate">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: p.colorVar }}
                  aria-hidden
                />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {p.posts} pub. · {percent(p.engagementShare, 0)}
              </span>
            </div>
            <ShareBar value={p.engagementShare} target={p.targetShare} colorVar={p.colorVar} />
            <p className="text-[11px] text-muted-foreground/80">
              Cible {percent(p.targetShare, 0)} ·{" "}
              {p.engagementShare >= p.targetShare ? "au-dessus" : "en deçà"} de l'objectif
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
