import { Check, CircleHelp, Clock, type LucideIcon, TriangleAlert, X, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Approval, ApprovalMode, ContentStatus, Reviewer } from "@/lib/domain"
import type { Format, Locale, Translator } from "@/lib/i18n"
import { getFormat, getLabels, getLocale, getT } from "@/lib/i18n/server"
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

function reviewerActivity(t: Translator, f: Format, reviewer?: Reviewer): string {
  if (!reviewer) return t("studio.review.noReviewer")
  if (!reviewer.lastActiveAt) {
    return t("studio.review.neverOpened", { name: reviewer.name })
  }
  return t("studio.review.opened", { name: reviewer.name, ago: f.relative(reviewer.lastActiveAt) })
}

function deriveBanner(
  t: Translator,
  f: Format,
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
      title: t("studio.review.staleTitle"),
      detail: t("studio.review.staleDetail", {
        name: reviewer?.name ?? t("studio.review.fallbackClient"),
      }),
    }
  }
  if (status === "in_review") {
    return {
      tone: "info",
      icon: Clock,
      title: t("studio.review.pendingTitle"),
      detail: reviewerActivity(t, f, reviewer),
    }
  }
  if (status === "changes_requested") {
    return {
      tone: "warning",
      icon: X,
      title: t("studio.review.changesTitle"),
      detail: t("studio.review.changesDetail"),
    }
  }
  if (latest?.decision === "approved") {
    return {
      tone: "success",
      icon: Check,
      title: t("studio.review.approvedTitle", { version: latest.versionLabel }),
      detail: t("studio.review.approvedDetail", {
        name: reviewer?.name ?? t("studio.review.fallbackClientShort"),
        ago: f.relative(latest.createdAt),
      }),
    }
  }
  if (approvalMode === "auto") {
    return {
      tone: "neutral",
      icon: Zap,
      title: t("studio.review.autoTitle"),
      detail: t("studio.review.autoDetail"),
    }
  }
  return {
    tone: "neutral",
    icon: CircleHelp,
    title: t("studio.review.notSentTitle"),
    detail: t("studio.review.notSentDetail"),
  }
}

export async function ContentReviewPanel({
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
  const t = await getT()
  const f = await getFormat()
  const lbl = await getLabels()
  const locale = await getLocale()
  const banner = deriveBanner(t, f, status, approvalStale, approvals, approvalMode, reviewer)
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
          <p className="text-xs font-medium text-muted-foreground">{t("studio.review.history")}</p>
          {approvals.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              hasVersions={hasVersions}
              t={t}
              f={f}
              locale={locale}
            />
          ))}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {t("studio.review.mode", { mode: lbl.approvalMode(approvalMode).toLowerCase() })}
      </p>
    </div>
  )
}

function ApprovalRow({
  approval,
  hasVersions,
  t,
  f,
  locale,
}: {
  approval: Approval
  hasVersions: boolean
  t: Translator
  f: Format
  locale: Locale
}) {
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
          <p className="text-sm font-medium">
            {approved ? t("studio.review.decisionApproved") : t("studio.review.decisionChanges")}
          </p>
          {hasVersions ? (
            <a href="#versions" title={t("studio.review.versionTitle")}>
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
          {f.relative(approval.createdAt)}
        </p>
      </div>
    </div>
  )
}
