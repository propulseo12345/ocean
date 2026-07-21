import { CheckCircle2, ClipboardCheck, History } from "lucide-react"
import type { Metadata } from "next"
import { PortalCard } from "@/components/portal/portal-card"
import { EmptyState } from "@/components/shared/empty-state"
import { getReviewerContext } from "@/lib/auth/org-context"
import { getPortalContent } from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import type { Translator } from "@/lib/i18n/translator"
import type { Client, ContentStatus } from "@/lib/mocks/types"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("portal.home.metaTitle") }
}

const TO_REVIEW: ContentStatus[] = ["in_review", "changes_requested"]

export default async function PortalPage() {
  const t = await getT()
  const ctx = await getReviewerContext()
  const client = ctx.clients[0] as Client
  const reviewer = ctx.reviewer
  const tz = client.timezone
  const firstName = reviewer?.name.split(" ")[0] ?? ""

  const content = await getPortalContent(ctx.clientIds)
  const toReview = content.filter((c) => TO_REVIEW.includes(c.status))
  const history = content
    .filter((c) => !TO_REVIEW.includes(c.status))
    .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt))

  return (
    <div className="space-y-8">
      <ReviewBanner count={toReview.length} firstName={firstName} t={t} />

      <section className="space-y-3">
        <SectionTitle
          icon={ClipboardCheck}
          title={t("portal.home.sectionToValidate")}
          count={toReview.length}
        />
        {toReview.length > 0 ? (
          <div className="grid gap-3">
            {toReview.map((c) => (
              <PortalCard key={c.id} content={c} timezone={tz} emphasis />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title={t("portal.home.emptyValidatedTitle")}
            description={t("portal.home.emptyValidatedDescription")}
          />
        )}
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle
            icon={History}
            title={t("portal.home.sectionHistory")}
            count={history.length}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((c) => (
              <PortalCard key={c.id} content={c} timezone={tz} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ReviewBanner({
  count,
  firstName,
  t,
}: {
  count: number
  firstName: string
  t: Translator
}) {
  const hasItems = count > 0
  return (
    <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/5 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {t("portal.home.greeting", { name: firstName ? ` ${firstName}` : "" })}
      </p>
      <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-balance">
        {hasItems ? t("portal.home.toValidateHeading", { count }) : t("portal.home.upToDate")}
      </h1>
      <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
        {hasItems ? t("portal.home.toValidateLead") : t("portal.home.upToDateLead")}
      </p>
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof ClipboardCheck
  title: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  )
}
