import { CheckCircle2, ClipboardCheck, History } from "lucide-react"
import type { Metadata } from "next"
import { PortalCard } from "@/components/portal/portal-card"
import { EmptyState } from "@/components/shared/empty-state"
import { DEMO_REVIEWER_CLIENT_ID, getClient, getPortalContent, getReviewer } from "@/lib/mocks"
import type { Client, ContentStatus } from "@/lib/mocks/types"

export const metadata: Metadata = { title: "Espace de validation" }

const TO_REVIEW: ContentStatus[] = ["in_review", "changes_requested"]

export default function PortalPage() {
  const client = getClient(DEMO_REVIEWER_CLIENT_ID) as Client
  const reviewer = getReviewer(DEMO_REVIEWER_CLIENT_ID)
  const tz = client.timezone
  const firstName = reviewer?.name.split(" ")[0] ?? ""

  const content = getPortalContent()
  const toReview = content.filter((c) => TO_REVIEW.includes(c.status))
  const history = content
    .filter((c) => !TO_REVIEW.includes(c.status))
    .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt))

  return (
    <div className="space-y-8">
      <ReviewBanner count={toReview.length} firstName={firstName} />

      <section className="space-y-3">
        <SectionTitle icon={ClipboardCheck} title="À valider" count={toReview.length} />
        {toReview.length > 0 ? (
          <div className="grid gap-3">
            {toReview.map((c) => (
              <PortalCard key={c.id} content={c} timezone={tz} emphasis />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Tout est validé"
            description="Aucune publication n'attend votre relecture pour l'instant."
          />
        )}
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle icon={History} title="Historique" count={history.length} />
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

function ReviewBanner({ count, firstName }: { count: number; firstName: string }) {
  const hasItems = count > 0
  return (
    <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/5 sm:p-6">
      <p className="text-sm text-muted-foreground">Bonjour{firstName ? ` ${firstName}` : ""},</p>
      <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-balance">
        {hasItems
          ? `Vous avez ${count} publication${count > 1 ? "s" : ""} à valider`
          : "Vous êtes à jour"}
      </h1>
      <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
        {hasItems
          ? "Relisez chaque publication, laissez vos remarques si besoin, puis approuvez en un clic."
          : "Dès qu'une nouvelle publication est prête, vous la retrouverez ici."}
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
