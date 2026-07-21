import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLocale, useT } from "@/lib/i18n"
import type { PillarSlice } from "./perf-data"
import { percent } from "./perf-utils"

function ShareBar({
  value,
  target,
  colorVar,
  targetTitle,
}: {
  value: number
  target: number
  colorVar: string
  targetTitle: string
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
        title={targetTitle}
        aria-hidden
      />
    </div>
  )
}

export function PerfPillarSplit({ pillars }: { pillars: PillarSlice[] }) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("performance.pillar.title")}</CardTitle>
        <CardDescription>{t("performance.pillar.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pillars.map((p) => {
          const target = percent(p.targetShare, locale, 0)
          return (
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
                  {t("performance.pillar.postsAndShare", {
                    posts: p.posts,
                    share: percent(p.engagementShare, locale, 0),
                  })}
                </span>
              </div>
              <ShareBar
                value={p.engagementShare}
                target={p.targetShare}
                colorVar={p.colorVar}
                targetTitle={t("performance.pillar.targetMarker", { target })}
              />
              <p className="text-[11px] text-muted-foreground/80">
                {p.engagementShare >= p.targetShare
                  ? t("performance.pillar.targetAbove", { target })
                  : t("performance.pillar.targetBelow", { target })}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
