"use client"

import { BellOff, CheckCheck, Inbox } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { NotificationRow } from "@/components/app/notifications/notification-row"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppNotification } from "@/lib/mocks/types"

type Filter = "all" | "unread"

function isFilter(value: unknown): value is Filter {
  return value === "all" || value === "unread"
}

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const [filter, setFilter] = useState<Filter>("all")

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [filter, notifications]
  )

  function handleMarkAllRead() {
    if (unreadCount === 0) {
      toast("Aucune notification non lue.")
      return
    }
    toast.success(`${unreadCount} notification(s) marquée(s) comme lues`, {
      description: "Action simulée (preview)",
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
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              Non lues
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
          disabled={unreadCount === 0}
        >
          <CheckCheck className="size-4" />
          Tout marquer comme lu
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={filter === "unread" ? BellOff : Inbox}
          title={filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}
          description={
            filter === "unread"
              ? "Tu es à jour — rien ne demande ton attention pour l'instant."
              : "Les alertes de publication, validation et reconnexion apparaîtront ici."
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
