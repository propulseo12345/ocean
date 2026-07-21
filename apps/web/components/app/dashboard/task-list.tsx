import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  type LucideIcon,
  Mail,
  Music2,
  OctagonAlert,
  PlugZap,
  Send,
} from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import type { DashboardTask } from "@/lib/domain"
import type { Format, MessageKey } from "@/lib/i18n"
import { getFormat, getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<DashboardTask["kind"], LucideIcon> = {
  publish_today: Send,
  failed: OctagonAlert,
  tiktok_draft: Music2,
  review_pending: Clock,
  reconnect: PlugZap,
  reschedule: CalendarClock,
  manual_due: Mail,
}

const TONE_CLASS: Record<DashboardTask["tone"], string> = {
  info: "text-info",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
  neutral: "text-muted-foreground",
}

// Sections ordonnées par urgence (libellé résolu via dashboard.group.*).
const GROUP_ORDER: { kind: DashboardTask["kind"]; labelKey: MessageKey }[] = [
  { kind: "failed", labelKey: "dashboard.group.failed" },
  { kind: "publish_today", labelKey: "dashboard.group.publish_today" },
  { kind: "tiktok_draft", labelKey: "dashboard.group.tiktok_draft" },
  { kind: "manual_due", labelKey: "dashboard.group.manual_due" },
  { kind: "reschedule", labelKey: "dashboard.group.reschedule" },
  { kind: "review_pending", labelKey: "dashboard.group.review_pending" },
  { kind: "reconnect", labelKey: "dashboard.group.reconnect" },
]

export async function TaskList({ tasks }: { tasks: DashboardTask[] }) {
  const t = await getT()
  const f = await getFormat()
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={t("dashboard.allClear")}
        description={t("dashboard.allClearHint")}
        className="border-0"
      />
    )
  }
  return (
    <div className="space-y-4">
      {GROUP_ORDER.map(({ kind, labelKey }) => {
        const group = tasks.filter((task) => task.kind === kind)
        if (group.length === 0) return null
        return (
          <section key={kind}>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t(labelKey)}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground tabular-nums">
                {group.length}
              </span>
            </h3>
            <ul className="divide-y">
              {group.map((task) => (
                <TaskRow key={task.id} task={task} f={f} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function TaskRow({ task, f }: { task: DashboardTask; f: Format }) {
  const Icon = KIND_ICON[task.kind]
  return (
    <li>
      <Link
        href={task.href}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted",
            TONE_CLASS[task.tone]
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{task.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{task.detail}</span>
        </span>
        {task.at ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {f.time(task.at)}
          </span>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </Link>
    </li>
  )
}
