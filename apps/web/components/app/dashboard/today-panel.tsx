import { CalendarOff } from "lucide-react"
import Link from "next/link"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { PlatformIcons } from "@/components/shared/platform-badge"
import { isSameDay } from "@/lib/format"
import { type Format, type Locale } from "@/lib/i18n"
import { getFormat, getLocale, getT } from "@/lib/i18n/server"
import type { AgendaItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

export async function TodayPanel({ items, timezone }: { items: AgendaItem[]; timezone: string }) {
  const t = await getT()
  const f = await getFormat()
  const locale = await getLocale()
  const todayItems = items.filter((it) =>
    isSameDay(it.kind === "event" ? it.event.startsAt : it.startsAt, undefined, timezone)
  )
  if (todayItems.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title={t("dashboard.freeDay")}
        description={t("dashboard.freeDayHint")}
        className="border-0 p-6"
      />
    )
  }
  return (
    <ul className="space-y-0.5">
      {todayItems.map((it) => (
        <AgendaRow
          key={it.id}
          item={it}
          tz={timezone}
          f={f}
          locale={locale}
          allDayLabel={t("dashboard.allDay")}
        />
      ))}
    </ul>
  )
}

function AgendaRow({
  item,
  tz,
  f,
  locale,
  allDayLabel,
}: {
  item: AgendaItem
  tz: string
  f: Format
  locale: Locale
  allDayLabel: string
}) {
  if (item.kind === "event") {
    const e = item.event
    return (
      <li className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2">
        <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">
          {e.allDay ? allDayLabel : f.time(e.startsAt, tz)}
        </span>
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.colorVar }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{e.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {e.calendarName}
          </span>
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
          {f.time(item.startsAt, tz)}
        </span>
        <ClientAvatar client={client} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{content.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{client.name}</span>
        </span>
        <PlatformIcons platforms={content.targets.map((target) => target.platform)} />
      </Link>
    </li>
  )
}
