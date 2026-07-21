"use client"

import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { StatusDot } from "@/components/shared/status-dot"
import { formatTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { manualKindOf } from "./calendar-insights"
import type { DayContext } from "./calendar-types"
import { EntryMarkers, entryToneClass, PlatformDots, pillarEdgeStyle } from "./entry-markers"
import { EntryShell } from "./entry-shell"

// Carte compacte d'un contenu en vue mois : statut, heure (fuseau client),
// vignette, titre, marqueurs et plateformes. Drag + aperçu rapide via le shell.

export function DayEntry({ item, ctx }: { item: ContentItem; ctx: DayContext }) {
  const t = useT()
  const time = item.scheduledAt ? formatTime(item.scheduledAt, ctx.tz) : ""
  const title = item.title
  const tooltip = item.lastError
    ? item.lastError
    : t("calendar.dayEntry.tooltip", { time, title })
  const hasPillar = Boolean(item.pillarId && ctx.pillarById.get(item.pillarId))

  return (
    <EntryShell
      item={item}
      ctx={ctx}
      style={pillarEdgeStyle(item, ctx)}
      className={cn(
        "rounded-md px-1.5 py-1 text-[11px] transition-colors",
        hasPillar && "border-l-2",
        // Canal manuel (TikTok brouillon, newsletter…) : bordure pointillée.
        manualKindOf(item) !== null && "border border-dashed border-border",
        entryToneClass(item)
      )}
    >
      <span className="flex items-center gap-1.5" title={tooltip}>
        <StatusDot status={item.status} size="sm" withTooltip={false} />
        {item.media[0] ? (
          <MediaThumb
            media={item.media[0]}
            alt=""
            className="size-5 shrink-0 rounded"
            sizes="20px"
          />
        ) : (
          <FormatIcon format={item.format} className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="shrink-0 text-muted-foreground tabular-nums">{time}</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium",
            item.status === "failed" ? "text-destructive" : "text-foreground",
            item.status === "canceled" && "line-through"
          )}
        >
          {title}
        </span>
        <EntryMarkers item={item} ctx={ctx} />
        <PlatformDots platforms={item.targets.map((t) => t.platform)} />
      </span>
    </EntryShell>
  )
}
