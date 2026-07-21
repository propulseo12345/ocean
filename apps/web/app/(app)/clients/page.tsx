import { Clock, Plus, TriangleAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClients, getContentItems, getSocialAccounts } from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.listTitle") }
}

async function clientStats(orgId: string, clientId: string) {
  const items = await getContentItems(orgId, clientId)
  return {
    scheduled: items.filter((c) => c.status === "scheduled").length,
    review: items.filter((c) => c.status === "in_review" || c.status === "changes_requested")
      .length,
    published: items.filter((c) => c.status === "published" || c.status === "partially_published")
      .length,
  }
}

export default async function ClientsPage() {
  const t = await getT()
  const ctx = await getActiveOrg()
  const clients = await getClients(ctx.org.id)
  const archived = (await getClients(ctx.org.id, true)).filter((c) => c.archivedAt)
  const statsByClient = new Map(
    await Promise.all(
      clients.map(async (client) => [client.id, await clientStats(ctx.org.id, client.id)] as const)
    )
  )
  const accountsByClient = new Map(
    await Promise.all(
      clients.map(
        async (client) => [client.id, await getSocialAccounts(ctx.org.id, client.id)] as const
      )
    )
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.listTitle")}
        description={t("clients.listDescription")}
        actions={
          <Button render={<Link href={routes.clientNew} />}>
            <Plus />
            {t("clients.newClient")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const s = statsByClient.get(c.id) ?? { scheduled: 0, review: 0, published: 0 }
          const accounts = accountsByClient.get(c.id) ?? []
          const needsReauth = accounts.some((a) => a.status !== "connected")
          return (
            <Link
              key={c.id}
              href={routes.clientGrid(c.id)}
              className="group block rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="flex items-start gap-3">
                <ClientAvatar client={c} size={44} className="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-muted-foreground">@{c.handle}</p>
                </div>
                {needsReauth ? <TriangleAlert className="size-4 shrink-0 text-warning" /> : null}
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {c.timezone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {accounts.map((a) => (
                    <PlatformIcon key={a.id} platform={a.platform} className="size-3.5" />
                  ))}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
                <Stat value={s.scheduled} label={t("clients.statScheduled")} />
                <Stat value={s.review} label={t("clients.statReview")} />
                <Stat value={s.published} label={t("clients.statPublished")} />
              </div>
            </Link>
          )
        })}
      </div>

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground">
            {t("clients.archivedTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 opacity-70"
              >
                <ClientAvatar client={c} size={36} className="rounded-lg grayscale" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{t("clients.archivedCollab")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-heading text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
