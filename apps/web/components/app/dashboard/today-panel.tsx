import { CalendarOff } from "lucide-react"
import Link from "next/link"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { PlatformIcons } from "@/components/shared/platform-badge"
import { formatTime, isSameDay } from "@/lib/format"
import { CURRENT_USER, getUnifiedAgenda } from "@/lib/mocks"
import type { AgendaItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export function TodayPanel() {
  const tz = CURRENT_USER.timezone
  const items = getUnifiedAgenda().filter((it) =>
    isSameDay(it.kind === "event" ? it.event.startsAt : it.startsAt, undefined, tz)
  )
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Journée libre"
        description="Aucun rendez-vous ni publication aujourd'hui."
        className="border-0 p-6"
      />
    )
  }
  return (
    <ul className="space-y-0.5">
      {items.map((it) => (
        <AgendaRow key={it.id} item={it} tz={tz} />
      ))}
    </ul>
  )
}

function AgendaRow({ item, tz }: { item: AgendaItem; tz: string }) {
  if (item.kind === "event") {
    const e = item.event
    return (
      <li className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2">
        <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">
          {e.allDay ? "Jour" : formatTime(e.startsAt, tz)}
        </span>
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.colorVar }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{e.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{e.calendarName}</span>
        </span>
      </li>
    )
  }
  const { content, client } = item
  return (
    <li>
      <Link
        href={routes.content(client.id, content.id)}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
      >
        <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatTime(item.startsAt, tz)}
        </span>
        <ClientAvatar client={client} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{content.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{client.name}</span>
        </span>
        <PlatformIcons platforms={content.targets.map((t) => t.platform)} />
      </Link>
    </li>
  )
}
