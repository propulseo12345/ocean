import { Check, CircleHelp, Clock, type LucideIcon, TriangleAlert, X, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatRelative } from "@/lib/format"
import { approvalModeMeta } from "@/lib/mocks/labels"
import type { Approval, ApprovalMode, ContentStatus, Reviewer } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// État de validation du contenu : bandeau de synthèse (en attente, approuvé,
// approbation périmée…) + historique des décisions du client (versionnées).

type BannerTone = "success" | "warning" | "info" | "neutral"

interface Banner {
  tone: BannerTone
  icon: LucideIcon
  title: string
  detail: string
}

const TONE_BOX: Record<BannerTone, string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-info/30 bg-info/5",
  neutral: "border-border bg-muted/40",
}

const TONE_TEXT: Record<BannerTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-foreground",
}

function reviewerActivity(reviewer?: Reviewer): string {
  if (!reviewer) return "Aucun reviewer invité pour ce client."
  if (!reviewer.lastActiveAt) {
    return `${reviewer.name} n'a jamais ouvert le portail — pense à relancer par email.`
  }
  return `${reviewer.name} a ouvert le portail ${formatRelative(reviewer.lastActiveAt)}.`
}

function deriveBanner(
  status: ContentStatus,
  approvalStale: boolean,
  approvals: Approval[],
  approvalMode: ApprovalMode,
  reviewer?: Reviewer
): Banner {
  const latest = approvals[approvals.length - 1]
  if (approvalStale) {
    return {
      tone: "warning",
      icon: TriangleAlert,
      title: "Approbation périmée",
      detail: `Le contenu a changé depuis l'approbation — l'accord de ${reviewer?.name ?? "ton client"} porte sur une version antérieure. Renvoie-le en revue.`,
    }
  }
  if (status === "in_review") {
    return {
      tone: "info",
      icon: Clock,
      title: "En attente de validation",
      detail: reviewerActivity(reviewer),
    }
  }
  if (status === "changes_requested") {
    return {
      tone: "warning",
      icon: X,
      title: "Modifications demandées",
      detail: "Corrige le contenu puis renvoie une nouvelle version en revue.",
    }
  }
  if (latest?.decision === "approved") {
    return {
      tone: "success",
      icon: Check,
      title: `Approuvé (${latest.versionLabel})`,
      detail: `Validé par ${reviewer?.name ?? "le client"} ${formatRelative(latest.createdAt)}.`,
    }
  }
  if (approvalMode === "auto") {
    return {
      tone: "neutral",
      icon: Zap,
      title: "Publication directe",
      detail: "Ce client n'exige pas de validation — le contenu part dès programmation.",
    }
  }
  return {
    tone: "neutral",
    icon: CircleHelp,
    title: "Pas encore envoyé en validation",
    detail: "Envoie le contenu en revue pour obtenir l'accord du client avant publication.",
  }
}

export function ContentReviewPanel({
  status,
  approvalStale,
  approvals,
  approvalMode,
  reviewer,
  hasVersions,
}: {
  status: ContentStatus
  approvalStale: boolean
  approvals: Approval[]
  approvalMode: ApprovalMode
  reviewer?: Reviewer
  hasVersions: boolean
}) {
  const banner = deriveBanner(status, approvalStale, approvals, approvalMode, reviewer)
  const Icon = banner.icon

  return (
    <div className="space-y-3">
      <div
        className={cn("flex items-start gap-2.5 rounded-lg border p-2.5", TONE_BOX[banner.tone])}
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[banner.tone])} />
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", TONE_TEXT[banner.tone])}>{banner.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{banner.detail}</p>
        </div>
      </div>

      {approvals.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Historique des décisions</p>
          {approvals.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} hasVersions={hasVersions} />
          ))}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Mode de validation du client : {approvalModeMeta[approvalMode].label.toLowerCase()}.
      </p>
    </div>
  )
}

function ApprovalRow({ approval, hasVersions }: { approval: Approval; hasVersions: boolean }) {
  const approved = approval.decision === "approved"
  const versionBadge = (
    <Badge variant="outline" className="h-4 px-1.5 font-mono text-[10px]">
      {approval.versionLabel}
    </Badge>
  )

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-2.5",
        approved ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          approved ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
        )}
      >
        {approved ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{approved ? "Approuvé" : "Modifications demandées"}</p>
          {hasVersions ? (
            <a href="#versions" title="Voir cette version dans l'historique">
              {versionBadge}
            </a>
          ) : (
            versionBadge
          )}
        </div>
        {approval.message ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{approval.message}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {formatRelative(approval.createdAt)}
        </p>
      </div>
    </div>
  )
}
