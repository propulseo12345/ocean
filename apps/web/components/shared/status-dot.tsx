"use client"

import type { ContentStatus, TargetStatus } from "@/lib/domain"
import { contentStatusMeta, targetStatusMeta, toneDotClass } from "@/lib/domain/labels"
import { useLabels } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Pastille de statut compacte (tuiles de grille, cases du calendrier).
// Tooltip natif via title, libellé pour lecteurs d'écran.

const SIZE_CLASS = {
  sm: "size-2",
  md: "size-2.5",
} as const

type StatusDotSize = keyof typeof SIZE_CLASS

function Dot({
  label,
  tone,
  size,
  withTooltip,
  className,
}: {
  label: string
  tone: keyof typeof toneDotClass
  size: StatusDotSize
  withTooltip: boolean
  className?: string
}) {
  return (
    <span
      title={withTooltip ? label : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      <span
        className={cn("rounded-full ring-2 ring-background", SIZE_CLASS[size], toneDotClass[tone])}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function StatusDot({
  status,
  size = "sm",
  withTooltip = true,
  className,
}: {
  status: ContentStatus
  size?: StatusDotSize
  withTooltip?: boolean
  className?: string
}) {
  const lbl = useLabels()
  const m = contentStatusMeta[status]
  return (
    <Dot
      label={lbl.contentStatus(status)}
      tone={m.tone}
      size={size}
      withTooltip={withTooltip}
      className={className}
    />
  )
}

export function TargetStatusDot({
  status,
  size = "sm",
  withTooltip = true,
  className,
}: {
  status: TargetStatus
  size?: StatusDotSize
  withTooltip?: boolean
  className?: string
}) {
  const lbl = useLabels()
  const m = targetStatusMeta[status]
  return (
    <Dot
      label={lbl.targetStatus(status)}
      tone={m.tone}
      size={size}
      withTooltip={withTooltip}
      className={className}
    />
  )
}
