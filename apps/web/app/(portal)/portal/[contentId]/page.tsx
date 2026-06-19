import { ArrowLeft, CalendarClock, CheckCircle2, RotateCcw } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AnnotationViewer } from "@/components/portal/annotation-viewer"
import { clientFacingStatus, statusBadgeLabel } from "@/components/portal/portal-card"
import { ReviewActions } from "@/components/portal/review-actions"
import { FormatLabel } from "@/components/shared/format-icon"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatDateTime, formatRelative } from "@/lib/format"
import {
  DEMO_REVIEWER_CLIENT_ID,
  getApprovals,
  getClient,
  getComments,
  getContentItem,
} from "@/lib/mocks"
import type { Approval, Client } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export const metadata: Metadata = { title: "Relecture" }

export default async function PortalContentPage({
  params,
}: {
  params: Promise<{ contentId: string }>
}) {
  const { contentId } = await params
  const content = getContentItem(contentId)

  // Le reviewer ne voit que SON client (cl_brulerie en démo) — défense UI.
  if (!content || content.clientId !== DEMO_REVIEWER_CLIENT_ID) notFound()

  const client = getClient(content.clientId) as Client
  const tz = client.timezone
  const comments = getComments(contentId)
  const approvals = getApprovals(contentId)
  const status = clientFacingStatus(content.status)
  const isToReview = content.status === "in_review" || content.status === "changes_requested"

  return (
    <div className="space-y-6">
      <Link
        href={routes.portal}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à l'espace de validation
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          <AnnotationViewer media={content.media} comments={comments} alt={content.title} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <FormatLabel format={content.format} className="text-muted-foreground" />
              <ContentStatusBadge status={status} />
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-balance">
              {content.title}
            </h1>
            {content.scheduledAt ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClock className="size-4" />
                {formatDateTime(content.scheduledAt, tz)}
              </p>
            ) : null}
          </div>

          <CaptionBlock caption={content.caption} hashtags={content.hashtags} />

          {isToReview ? (
            <Card>
              <CardHeader>
                <CardTitle>Votre décision</CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewActions contentTitle={content.title} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              Publication {statusBadgeLabel(content.status).toLowerCase()} — rien à faire de votre
              côté.
            </div>
          )}

          <ApprovalHistory approvals={approvals} />
        </aside>
      </div>
    </div>
  )
}

function CaptionBlock({ caption, hashtags }: { caption: string; hashtags: string[] }) {
  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-4 text-sm">
      <p className="whitespace-pre-line leading-relaxed text-foreground/90">{caption}</p>
      {hashtags.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function ApprovalHistory({ approvals }: { approvals: Approval[] }) {
  if (approvals.length === 0) return null
  return (
    <div className="space-y-2.5">
      <h2 className="font-heading text-sm font-semibold text-muted-foreground">
        Historique des décisions
      </h2>
      <ul className="space-y-2">
        {approvals
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((a) => {
            const approved = a.decision === "approved"
            return (
              <li key={a.id} className="flex gap-2.5 rounded-lg border p-2.5">
                <span className={approved ? "mt-0.5 text-success" : "mt-0.5 text-warning"}>
                  {approved ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {approved ? "Approuvé" : "Modifications demandées"}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {a.versionLabel}
                    </span>
                  </p>
                  {a.message ? <p className="text-sm text-muted-foreground">{a.message}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {formatRelative(a.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
