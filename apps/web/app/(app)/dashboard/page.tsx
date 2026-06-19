import { Clock, OctagonAlert, PlugZap, Send } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { KpiCard } from "@/components/app/dashboard/kpi-card"
import { TaskList } from "@/components/app/dashboard/task-list"
import { TodayPanel } from "@/components/app/dashboard/today-panel"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatRelative } from "@/lib/format"
import { CURRENT_USER, getDashboardTasks, getNotifications } from "@/lib/mocks"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { DashboardTask } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export const metadata: Metadata = { title: "Tableau de bord" }

export default function DashboardPage() {
  const tasks = getDashboardTasks()
  const count = (kind: DashboardTask["kind"]) => tasks.filter((t) => t.kind === kind).length
  const firstName = CURRENT_USER.name.split(" ")[0]
  const today = formatDate(MOCK_NOW.toISOString(), CURRENT_USER.timezone)
  const recent = getNotifications("owner").slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${firstName}`}
        description={`Voici ta journée — ${today}.`}
        actions={
          <Button variant="outline" render={<Link href={routes.clients} />}>
            Voir les clients
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Send}
          value={count("publish_today")}
          label="À publier aujourd'hui"
          tone="info"
          href={routes.agenda}
        />
        <KpiCard
          icon={Clock}
          value={count("review_pending")}
          label="En attente de validation"
          tone="warning"
          href={routes.clients}
        />
        <KpiCard
          icon={OctagonAlert}
          value={count("failed")}
          label="Échecs à traiter"
          tone="danger"
          href={routes.clients}
        />
        <KpiCard
          icon={PlugZap}
          value={count("reconnect")}
          label="Comptes à reconnecter"
          tone="warning"
          href={routes.settings}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tâches du jour</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">{tasks.length} au total</span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasks} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aujourd'hui</CardTitle>
              <CardAction>
                <Button variant="link" size="sm" render={<Link href={routes.agenda} />}>
                  Agenda
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TodayPanel />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {recent.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="group flex gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm group-hover:underline">
                          {n.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {n.body}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatRelative(n.createdAt)}
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
