"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatRelative } from "@/lib/format"
import { getNotifications, getUnreadCount } from "@/lib/mocks"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"

export function NotificationsButton() {
  const items = getNotifications("owner").slice(0, 6)
  const unread = getUnreadCount("owner")
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="size-4" />
            {unread > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 ? (
            <span className="text-xs text-muted-foreground">{unread} non lues</span>
          ) : null}
        </div>
        <ScrollArea className="max-h-80">
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className={cn(
                    "flex gap-2.5 px-3 py-2.5 hover:bg-muted/60",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-primary"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                      {formatRelative(n.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            render={<Link href={routes.notifications} />}
          >
            Voir toutes les notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
