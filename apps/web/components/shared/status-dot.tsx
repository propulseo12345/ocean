import { contentStatusMeta, targetStatusMeta, toneDotClass } from "@/lib/mocks/labels"
import type { ContentStatus, TargetStatus } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Pastille de statut compacte (tuiles de grille, cases du calendrier).
// Server-compatible : tooltip natif via title, libellé pour lecteurs d'écran.

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
  const m = contentStatusMeta[status]
  return (
    <Dot
      label={m.label}
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
  const m = targetStatusMeta[status]
  return (
    <Dot
      label={m.label}
      tone={m.tone}
      size={size}
      withTooltip={withTooltip}
      className={className}
    />
  )
}
