"use client"

import { BellOff, CheckCheck, Inbox } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { NotificationRow } from "@/components/app/notifications/notification-row"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { markAllNotificationsRead } from "@/lib/actions/notifications"
import type { AppNotification } from "@/lib/domain"
import { useT } from "@/lib/i18n"

type Filter = "all" | "unread"

function isFilter(value: unknown): value is Filter {
  return value === "all" || value === "unread"
}

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const t = useT()
  const [filter, setFilter] = useState<Filter>("all")
  const [pending, startTransition] = useTransition()

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [filter, notifications]
  )

  function handleMarkAllRead() {
    if (unreadCount === 0) {
      toast(t("notifications.noneUnreadToast"))
      return
    }
    const count = unreadCount
    startTransition(async () => {
      const res = await markAllNotificationsRead()
      if (!res.ok) {
        toast.error(t("notifications.markAllError"))
        return
      }
      toast.success(t("notifications.markedReadToast", { count }), {
        description: t("notifications.markedReadToastDescription"),
      })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            if (isFilter(value)) setFilter(value)
          }}
        >
          <TabsList>
            <TabsTrigger value="all">{t("notifications.filterAll")}</TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              {t("notifications.filterUnread")}
              {unreadCount > 0 ? (
                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                  {unreadCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || pending}
        >
          <CheckCheck className="size-4" />
          {t("notifications.markAllRead")}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={filter === "unread" ? BellOff : Inbox}
          title={
            filter === "unread"
              ? t("notifications.emptyUnreadTitle")
              : t("notifications.emptyTitle")
          }
          description={
            filter === "unread"
              ? t("notifications.emptyUnreadDescription")
              : t("notifications.emptyDescription")
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">
            {visible.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
