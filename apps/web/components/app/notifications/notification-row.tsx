import {
  Bell,
  CheckCircle2,
  Clock,
  type LucideIcon,
  Mail,
  MessageSquare,
  Music2,
  OctagonAlert,
  PlugZap,
  Smartphone,
  TriangleAlert,
} from "lucide-react"
import Link from "next/link"
import { formatRelative } from "@/lib/format"
import type { AppNotification, NotificationChannel } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<string, LucideIcon> = {
  publish_failed: OctagonAlert,
  token_reauth_needed: PlugZap,
  tiktok_draft_pushed: Music2,
  changes_requested: MessageSquare,
  content_approved: CheckCircle2,
  publish_succeeded: CheckCircle2,
  publish_delayed: Clock,
  review_comment: MessageSquare,
  manual_due: Mail,
  watchdog: TriangleAlert,
}

const TYPE_TONE: Record<string, string> = {
  publish_failed: "text-destructive",
  token_reauth_needed: "text-warning",
  tiktok_draft_pushed: "text-info",
  changes_requested: "text-warning",
  content_approved: "text-success",
  publish_succeeded: "text-success",
  publish_delayed: "text-warning",
  review_comment: "text-info",
  manual_due: "text-info",
  watchdog: "text-destructive",
}

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: LucideIcon }> = {
  in_app: { label: "In-app", icon: Bell },
  push: { label: "Push", icon: Smartphone },
  email: { label: "E-mail", icon: Mail },
}

function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  const m = CHANNEL_META[channel]
  const Icon = m.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="size-3" />
      {m.label}
    </span>
  )
}

export function NotificationRow({ notification }: { notification: AppNotification }) {
  const Icon = TYPE_ICON[notification.type] ?? Bell
  const tone = TYPE_TONE[notification.type] ?? "text-muted-foreground"
  return (
    <Link
      href={notification.href}
      className={cn(
        "group flex gap-3 px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4",
        !notification.read && "bg-primary/[0.04]"
      )}
    >
      <span
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted", tone)}
      >
        <Icon className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
            {notification.title}
          </p>
          {!notification.read ? (
            <span
              role="img"
              aria-label="Non lue"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            />
          ) : null}
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground/80 tabular-nums">
            {formatRelative(notification.createdAt)}
          </span>
          <span className="text-muted-foreground/40">·</span>
          {notification.channels.map((c) => (
            <ChannelBadge key={c} channel={c} />
          ))}
        </div>
      </div>
    </Link>
  )
}
