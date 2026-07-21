import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { StatusTone } from "@/lib/domain/labels"
import { toneTextClass } from "@/lib/domain/labels"
import { cn } from "@/lib/utils"

const toneBg: Record<StatusTone, string> = {
  success: "bg-success/10",
  warning: "bg-warning/10",
  info: "bg-info/10",
  danger: "bg-destructive/10",
  neutral: "bg-muted",
  brand: "bg-primary/10",
}

export function KpiCard({
  icon: Icon,
  value,
  label,
  tone = "neutral",
  href,
}: {
  icon: LucideIcon
  value: number | string
  label: string
  tone?: StatusTone
  href?: string
}) {
  const body = (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          toneBg[tone],
          toneTextClass[tone]
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}
