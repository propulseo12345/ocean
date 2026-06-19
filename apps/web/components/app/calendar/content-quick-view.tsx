"use client"

import {
  BellRing,
  CalendarClock,
  ClipboardCopy,
  Copy,
  ExternalLink,
  RotateCcw,
  Send,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { MediaThumb } from "@/components/shared/media-thumb"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { ContentStatusBadge, TargetStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDateTime } from "@/lib/format"
import { pick, useLabels, useLocale, useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { manualKindOf } from "./calendar-insights"
import { isMovable } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"

// Aperçu rapide d'un contenu (popover) : consultation et actions sans quitter
// le calendrier.

const CAPTION_PREVIEW_LENGTH = 140

export function ContentQuickView({ item, ctx }: { item: ContentItem; ctx: DayContext }) {
  const tr = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  const title = pick(item.title, locale)
  const rawCaption = pick(item.caption, locale)
  const caption =
    rawCaption.length > CAPTION_PREVIEW_LENGTH
      ? `${rawCaption.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()}…`
      : rawCaption
  const waiting = ctx.waitingDays.get(item.id)
  const manual = manualKindOf(item)
  const pillar = item.pillarId ? ctx.pillarById.get(item.pillarId) : undefined

  return (
    <div className="w-72 space-y-2.5">
      {item.media[0] ? (
        <MediaThumb
          media={item.media[0]}
          alt={title}
          count={item.media.length}
          className="aspect-video rounded-lg"
          sizes="288px"
        />
      ) : null}

      <div className="space-y-1">
        <p className="text-sm leading-snug font-medium">{title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <ContentStatusBadge status={item.status} />
          {item.scheduledAt ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(item.scheduledAt, ctx.tz)}
            </span>
          ) : null}
        </div>
        {pillar ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: pillar.colorVar }}
              aria-hidden
            />
            {pick(pillar.name, locale)}
          </p>
        ) : null}
      </div>

      {caption ? <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p> : null}

      <ul className="space-y-1">
        {item.targets.map((tg) => (
          <li key={tg.id} className="flex items-center gap-1.5 text-xs">
            <PlatformIcon platform={tg.platform} className="size-3.5" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {lbl.platform(tg.platform)}
            </span>
            <TargetStatusBadge status={tg.status} className="text-[10px]" />
          </li>
        ))}
      </ul>

      {item.lastError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {pick(item.lastError, locale)}
        </p>
      ) : null}

      {manual === "tiktok" ? (
        <p className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
          <BellRing className="size-3.5 shrink-0" aria-hidden />
          {tr("calendar.quickView.tiktokDraft")}
        </p>
      ) : null}
      {manual === "manual" ? (
        <p className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
          <BellRing className="size-3.5 shrink-0" aria-hidden />
          {tr("calendar.quickView.manualPublish")}
        </p>
      ) : null}

      {waiting !== undefined ? (
        <p className="text-xs text-warning">
          {waiting >= 1
            ? tr("calendar.quickView.awaitingReviewSince", { days: waiting })
            : tr("calendar.quickView.awaitingReview")}
        </p>
      ) : null}

      <Separator />

      <div className="flex flex-wrap gap-1">
        <Button
          size="xs"
          variant="outline"
          render={<Link href={routes.content(ctx.clientId, item.id)} />}
        >
          <ExternalLink data-icon="inline-start" />
          {tr("calendar.quickView.openStudio")}
        </Button>
        {isMovable(item) ? (
          <Button size="xs" variant="outline" onClick={() => ctx.callbacks.onReschedule(item)}>
            <CalendarClock data-icon="inline-start" />
            {tr("calendar.quickView.reschedule")}
          </Button>
        ) : null}
        <Button size="xs" variant="outline" onClick={() => ctx.callbacks.onDuplicate(item)}>
          <Copy data-icon="inline-start" />
          {tr("calendar.quickView.duplicate")}
        </Button>
        {item.status === "failed" || item.status === "partially_published" ? (
          <Button size="xs" variant="destructive" onClick={() => ctx.callbacks.onRetry(item)}>
            <RotateCcw data-icon="inline-start" />
            {tr("calendar.quickView.retry")}
          </Button>
        ) : null}
        {manual !== null ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(`${rawCaption}\n\n${item.hashtags.join(" ")}`)
              toast.success(tr("calendar.quickView.captionCopied"), {
                description: tr("calendar.quickView.captionCopiedDesc"),
              })
            }}
          >
            <ClipboardCopy data-icon="inline-start" />
            {tr("calendar.quickView.copyCaption")}
          </Button>
        ) : null}
        {waiting !== undefined ? (
          <Button size="xs" variant="outline" onClick={() => ctx.callbacks.onRemind(item)}>
            <Send data-icon="inline-start" />
            {tr("calendar.quickView.remindClient")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
