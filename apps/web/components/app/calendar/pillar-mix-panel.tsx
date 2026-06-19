"use client"

import { TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PillarMixRow } from "./calendar-insights"

// Mix éditorial du mois : part réelle planifiée vs part cible par pilier.
// Un écart > 10 points est signalé (garde-fou « tout promo »).

export function PillarMixPanel({ rows }: { rows: PillarMixRow[] }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-heading text-sm font-semibold">Mix du mois</h3>
        <p className="text-xs text-muted-foreground">
          Part réelle planifiée vs part promise au client.
        </p>
      </div>
      <ul className="space-y-2.5">
        {rows.map(({ pillar, count, share, drift }) => (
          <li key={pillar.id} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: pillar.colorVar }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate font-medium">{pillar.name}</span>
              {drift ? (
                <TriangleAlert
                  className="size-3 text-warning"
                  aria-label={`Écart de ${Math.abs(share - pillar.targetShare)} points avec la cible`}
                />
              ) : null}
              <span
                className={cn("tabular-nums", drift ? "text-warning" : "text-muted-foreground")}
              >
                {share} % / {pillar.targetShare} %
              </span>
            </div>
            <div
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share}
              aria-label={`${pillar.name} : ${share} % planifié (cible ${pillar.targetShare} %, ${count} contenu${count > 1 ? "s" : ""})`}
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(share, 100)}%`, backgroundColor: pillar.colorVar }}
              />
              <span
                aria-hidden
                title={`Cible : ${pillar.targetShare} %`}
                className="absolute inset-y-0 w-px bg-foreground/50"
                style={{ left: `${Math.min(pillar.targetShare, 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Calculé sur les contenus datés du mois affiché (hors annulés).
      </p>
    </div>
  )
}
