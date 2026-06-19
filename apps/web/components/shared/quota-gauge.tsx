"use client"

import { useT } from "@/lib/i18n"
import type { QuotaUsage } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Jauge fine de quota plateforme — « 87/100 publications · 24 h ».
// Warning ≥ 80 %, danger ≥ 95 % (tokens uniquement).

const WARNING_AT = 0.8
const DANGER_AT = 0.95

const BAR_CLASS = {
  ok: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const

const TEXT_CLASS = {
  ok: "text-muted-foreground",
  warning: "text-warning",
  danger: "text-destructive",
} as const

function toneOf(ratio: number): keyof typeof BAR_CLASS {
  if (ratio >= DANGER_AT) return "danger"
  if (ratio >= WARNING_AT) return "warning"
  return "ok"
}

export function QuotaGauge({
  usage,
  showLabel = true,
  className,
}: {
  usage: QuotaUsage
  showLabel?: boolean
  className?: string
}) {
  const t = useT()
  const ratio = usage.limit > 0 ? Math.min(usage.used / usage.limit, 1) : 0
  const tone = toneOf(ratio)
  const label = `${usage.used}/${usage.limit} ${t(usage.windowKey)}`

  return (
    <div className={cn("min-w-0 space-y-1", className)} title={showLabel ? undefined : label}>
      {showLabel ? (
        <p className={cn("text-xs whitespace-nowrap tabular-nums", TEXT_CLASS[tone])}>{label}</p>
      ) : null}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        aria-label={`${t("quota.label")} ${label}`}
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", BAR_CLASS[tone])}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
