import { MapPin } from "lucide-react"
import Link from "next/link"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { PlatformIcons } from "@/components/shared/platform-badge"
import { useFormat, useLocale, useT } from "@/lib/i18n"
import type { AgendaItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"

// Bloc d'événement de calendrier — coloré avec la couleur du calendrier.
export function EventBlock({
  item,
  tz,
  compact = false,
}: {
  item: Extract<AgendaItem, { kind: "event" }>
  tz: string
  compact?: boolean
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const e = item.event
  return (
    <div
      className={cn(
        "h-full overflow-hidden rounded-md border-l-2 bg-card/60 px-2 py-1 text-left shadow-sm backdrop-blur-[1px]",
        compact ? "flex items-center gap-2" : "flex flex-col"
      )}
      style={{ borderLeftColor: e.colorVar }}
    >
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground tabular-nums">
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.colorVar }} />
        {e.allDay ? t("agenda.allDay") : f.time(e.startsAt, tz)}
      </span>
      <span className="truncate text-xs font-medium text-foreground">{e.title}</span>
      {!compact && e.location ? (
        <span className="mt-auto flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          <MapPin className="size-2.5 shrink-0" />
          {e.location}
        </span>
      ) : null}
    </div>
  )
}

// Bloc de publication planifiée — cliquable vers le contenu, avec marque client.
export function PublicationBlock({
  item,
  tz,
  compact = false,
}: {
  item: Extract<AgendaItem, { kind: "publication" }>
  tz: string
  compact?: boolean
}) {
  const f = useFormat()
  const { locale } = useLocale()
  const { content, client } = item
  return (
    <Link
      href={routes.content(client.id, content.id)}
      className={cn(
        "group h-full overflow-hidden rounded-md border border-dashed bg-primary/5 px-2 py-1 text-left shadow-sm transition-colors hover:bg-primary/10",
        compact ? "flex items-center gap-2" : "flex flex-col gap-0.5"
      )}
    >
      <span className="flex items-center gap-1.5">
        <ClientAvatar client={client} size={compact ? 22 : 16} />
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {f.time(item.startsAt, tz)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground group-hover:underline">
          {content.title}
        </span>
        {compact ? (
          <span className="block truncate text-[10px] text-muted-foreground">{client.name}</span>
        ) : null}
      </span>
      <PlatformIcons
        platforms={content.targets.map((t) => t.platform)}
        className={compact ? "" : "mt-auto"}
      />
    </Link>
  )
}

export function AgendaBlock({
  item,
  tz,
  compact,
}: {
  item: AgendaItem
  tz: string
  compact?: boolean
}) {
  return item.kind === "event" ? (
    <EventBlock item={item} tz={tz} compact={compact} />
  ) : (
    <PublicationBlock item={item} tz={tz} compact={compact} />
  )
}
