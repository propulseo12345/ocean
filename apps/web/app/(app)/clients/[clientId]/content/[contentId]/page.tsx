import { FileText, type LucideIcon, Mail, MessageSquareText } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ContentActions } from "@/components/app/studio/content-actions"
import { ContentDetailMedia } from "@/components/app/studio/content-detail-media"
import { ContentReviewPanel } from "@/components/app/studio/content-review-panel"
import { ContentTargets } from "@/components/app/studio/content-targets"
import { DetailActivity } from "@/components/app/studio/detail-activity"
import { DetailHeader } from "@/components/app/studio/detail-header"
import { DetailManualCenter, type ManualItem } from "@/components/app/studio/detail-manual-center"
import { DetailNativePreview } from "@/components/app/studio/detail-native-preview"
import { DetailThread } from "@/components/app/studio/detail-thread"
import { DetailVersions } from "@/components/app/studio/detail-versions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getActivityEntries,
  getApprovals,
  getClient,
  getClients,
  getComments,
  getContentItem,
  getContentVersions,
  getQuotaUsage,
  getReviewer,
  getSocialAccounts,
} from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import { MANUAL_PLATFORMS } from "@/lib/mocks/labels"
import type { ContentItem, ContentStatus, ContentTarget } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaContentDetail") }
}

const READ_ONLY: ContentStatus[] = ["publishing", "published", "partially_published"]

function isManualTarget(target: ContentTarget, content: ContentItem): boolean {
  if (target.status === "pushed_to_platform" || target.status === "awaiting_manual") return true
  return (
    MANUAL_PLATFORMS.includes(target.platform) &&
    (target.status === "pending" || target.status === "queued") &&
    content.scheduledAt !== null
  )
}

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; contentId: string }>
}) {
  const { clientId, contentId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  const content = await getContentItem(ctx.org.id, clientId, contentId)
  if (!client || !content) notFound()

  const t = await getT()
  const title = content.title
  const caption = content.caption

  const comments = await getComments(ctx.org.id, clientId, contentId)
  const approvals = await getApprovals(ctx.org.id, clientId, contentId)
  const versions = await getContentVersions(ctx.org.id, clientId, contentId)
  const activity = await getActivityEntries(ctx.org.id, clientId, contentId)
  const accounts = await getSocialAccounts(ctx.org.id, clientId)
  const reviewer = await getReviewer(ctx.org.id, clientId)
  const clients = await getClients(ctx.org.id)
  const quotas = Object.fromEntries(
    await Promise.all(accounts.map(async (a) => [a.id, await getQuotaUsage(ctx.org.id, a.id)]))
  )

  const canEdit = !READ_ONLY.includes(content.status) && content.status !== "in_review"
  const manualItems: ManualItem[] = content.targets
    .filter((t) => isManualTarget(t, content))
    .map((target) => ({
      target,
      account: accounts.find((a) => a.id === target.socialAccountId) ?? null,
    }))

  return (
    <div className="space-y-5">
      <DetailHeader client={client} content={content} canEdit={canEdit} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-5">
          <Tabs defaultValue="media">
            <TabsList>
              <TabsTrigger value="media">{t("clients.tabMedia")}</TabsTrigger>
              <TabsTrigger value="preview">{t("clients.tabNativePreview")}</TabsTrigger>
            </TabsList>
            <TabsContent value="media">
              <ContentDetailMedia
                media={content.media}
                title={title}
                comments={comments}
                format={content.format}
                coverUrl={content.coverUrl}
              />
            </TabsContent>
            <TabsContent value="preview">
              <DetailNativePreview client={client} content={content} accounts={accounts} />
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            {content.newsletterSubject ? (
              <Field icon={Mail} label={t("clients.fieldNewsletterSubject")}>
                <p className="text-sm font-medium">{content.newsletterSubject}</p>
              </Field>
            ) : null}

            <Field icon={FileText} label={t("clients.fieldCaption")}>
              <p className="text-sm whitespace-pre-line text-foreground/90">{caption}</p>
            </Field>

            {content.hashtags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {content.hashtags.map((h) => (
                  <Badge key={h} variant="secondary">
                    {h.startsWith("#") ? h : `#${h}`}
                  </Badge>
                ))}
              </div>
            ) : null}

            {content.firstComment ? (
              <Field icon={MessageSquareText} label={t("clients.fieldFirstComment")}>
                <p className="text-sm text-muted-foreground">
                  {content.firstComment}
                </p>
              </Field>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("clients.cardActions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentActions
                status={content.status}
                clientId={clientId}
                contentId={contentId}
                contentTitle={title}
                clients={clients}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("clients.cardClientReview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentReviewPanel
                status={content.status}
                approvalStale={Boolean(content.approvalStale)}
                approvals={approvals}
                approvalMode={client.approvalMode}
                reviewer={reviewer ?? undefined}
                hasVersions={versions.length > 0}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("clients.cardTargets", { count: content.targets.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentTargets
                targets={content.targets}
                client={client}
                accounts={accounts}
                quotas={quotas}
                contentError={content.lastError ? content.lastError : undefined}
                editHref={routes.contentEdit(clientId, contentId)}
              />
            </CardContent>
          </Card>

          {manualItems.length > 0 ? (
            <DetailManualCenter
              items={manualItems}
              caption={caption}
              hashtags={content.hashtags}
              scheduledAt={content.scheduledAt}
              timezone={client.timezone}
            />
          ) : null}

          <DetailThread
            comments={comments}
            internalNotes={content.internalNotes ? content.internalNotes : undefined}
            reviewerName={reviewer?.name}
          />

          <DetailVersions versions={versions} approvals={approvals} />

          <DetailActivity entries={activity} timezone={client.timezone} />
        </aside>
      </div>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      {children}
    </div>
  )
}
