"use client"

import { EllipsisVertical } from "lucide-react"
import Link from "next/link"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { PlatformIcons } from "@/components/shared/platform-badge"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { isMovable } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"

// Ligne d'un contenu dans le panneau Jour : vignette, heure (fuseau client),
// statut, plateformes et menu d'actions rapides.

export function DaySheetRow({ item, ctx }: { item: ContentItem; ctx: DayContext }) {
  const t = useT()
  const waiting = ctx.waitingDays.get(item.id)
  const title = item.title
  const lastError = item.lastError ? item.lastError : null
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-2",
        item.status === "failed" && "border-destructive/50 bg-destructive/5"
      )}
    >
      {item.media[0] ? (
        <MediaThumb
          media={item.media[0]}
          alt=""
          className="size-10 shrink-0 rounded-md"
          sizes="40px"
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <FormatIcon format={item.format} className="size-4 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {item.scheduledAt ? formatTime(item.scheduledAt, ctx.tz) : "—"}
          </span>
          <ContentStatusBadge status={item.status} className="text-[10px]" />
          <PlatformIcons platforms={item.targets.map((tg) => tg.platform)} />
        </div>
        {lastError ? (
          <p className="mt-1 truncate text-xs text-destructive" title={lastError}>
            {lastError}
          </p>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("calendar.daySheetRow.actions", { title })}
            />
          }
        >
          <EllipsisVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem render={<Link href={routes.content(ctx.clientId, item.id)} />}>
            {t("calendar.daySheetRow.openStudio")}
          </DropdownMenuItem>
          {isMovable(item) ? (
            <DropdownMenuItem onClick={() => ctx.callbacks.onReschedule(item)}>
              {t("calendar.daySheetRow.reschedule")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => ctx.callbacks.onDuplicate(item)}>
            {t("calendar.daySheetRow.duplicate")}
          </DropdownMenuItem>
          {item.status === "failed" || item.status === "partially_published" ? (
            <DropdownMenuItem onClick={() => ctx.callbacks.onRetry(item)}>
              {t("calendar.daySheetRow.retry")}
            </DropdownMenuItem>
          ) : null}
          {waiting !== undefined ? (
            <DropdownMenuItem onClick={() => ctx.callbacks.onRemind(item)}>
              {t("calendar.daySheetRow.remindClient")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
