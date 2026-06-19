import { Badge } from "@/components/ui/badge"
import type { StatusTone } from "@/lib/mocks/labels"
import {
  accountStatusMeta,
  contentStatusMeta,
  reviewStateMeta,
  targetStatusMeta,
  toneDotClass,
} from "@/lib/mocks/labels"
import type {
  AccountStatus,
  ContentStatus,
  ReviewRequestState,
  TargetStatus,
} from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

function Dot({ tone }: { tone: StatusTone }) {
  return <span className={cn("size-1.5 rounded-full", toneDotClass[tone])} />
}

export function ContentStatusBadge({
  status,
  className,
}: {
  status: ContentStatus
  className?: string
}) {
  const m = contentStatusMeta[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <Dot tone={m.tone} />
      {m.label}
    </Badge>
  )
}

export function TargetStatusBadge({
  status,
  className,
}: {
  status: TargetStatus
  className?: string
}) {
  const m = targetStatusMeta[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <Dot tone={m.tone} />
      {m.label}
    </Badge>
  )
}

export function AccountStatusBadge({
  status,
  className,
}: {
  status: AccountStatus
  className?: string
}) {
  const m = accountStatusMeta[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <Dot tone={m.tone} />
      {m.label}
    </Badge>
  )
}

export function ReviewStateBadge({
  state,
  className,
}: {
  state: ReviewRequestState
  className?: string
}) {
  const m = reviewStateMeta[state]
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <Dot tone={m.tone} />
      {m.label}
    </Badge>
  )
}
