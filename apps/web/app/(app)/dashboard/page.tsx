import { Clock, OctagonAlert, PlugZap, Send } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { KpiCard } from "@/components/app/dashboard/kpi-card"
import { TaskList } from "@/components/app/dashboard/task-list"
import { TodayPanel } from "@/components/app/dashboard/today-panel"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getActiveOrg } from "@/lib/auth/org-context"
import { nowIso } from "@/lib/clock"
import { getCurrentUser, getDashboardTasks, getNotifications, getUnifiedAgenda } from "@/lib/data"
import { pick } from "@/lib/i18n"
import { getFormat, getLocale, getT } from "@/lib/i18n/server"
import type { DashboardTask } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("dashboard.metaTitle") }
}

export default async function DashboardPage() {
  const t = await getT()
  const f = await getFormat()
  const locale = await getLocale()
  const ctx = await getActiveOrg()
  const user = await getCurrentUser()
  const tasks = await getDashboardTasks(ctx.org.id, t, locale)
  const count = (kind: DashboardTask["kind"]) => tasks.filter((task) => task.kind === kind).length
  const firstName = user.name.split(" ")[0]
  const today = f.date(nowIso(), user.timezone)
  const recent = (await getNotifications(ctx.org.id, "owner")).slice(0, 5)
  const agenda = await getUnifiedAgenda(ctx.org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.greeting", { name: firstName })}
        description={t("dashboard.yourDay", { date: today })}
        actions={
          <Button variant="outline" render={<Link href={routes.clients} />}>
            {t("dashboard.seeClients")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Send}
          value={count("publish_today")}
          label={t("dashboard.kpiPublishToday")}
          tone="info"
          href={routes.agenda}
        />
        <KpiCard
          icon={Clock}
          value={count("review_pending")}
          label={t("dashboard.kpiReviewPending")}
          tone="warning"
          href={routes.clients}
        />
        <KpiCard
          icon={OctagonAlert}
          value={count("failed")}
          label={t("dashboard.kpiFailed")}
          tone="danger"
          href={routes.clients}
        />
        <KpiCard
          icon={PlugZap}
          value={count("reconnect")}
          label={t("dashboard.kpiReconnect")}
          tone="warning"
          href={routes.settings}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.tasksTitle")}</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">
                {t("dashboard.tasksTotal", { count: tasks.length })}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasks} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.today")}</CardTitle>
              <CardAction>
                <Button variant="link" size="sm" render={<Link href={routes.agenda} />}>
                  {t("dashboard.agenda")}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TodayPanel items={agenda} timezone={user.timezone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {recent.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="group flex gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm group-hover:underline">
                          {pick(n.title, locale)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {pick(n.body, locale)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">
                          {f.relative(n.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
