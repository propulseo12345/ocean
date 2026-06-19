"use client"

import {
  AlarmClock,
  BellRing,
  CalendarOff,
  Hourglass,
  MessageSquare,
  TriangleAlert,
  Undo2,
} from "lucide-react"
import Link from "next/link"
import { FormatLabel } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { PlatformIcons } from "@/components/shared/platform-badge"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { pick, useFormat, useLocale, useT } from "@/lib/i18n"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { CardLabelPopover } from "./board-label-popover"
import { labelColorVar } from "./board-types"
import { type CardReviewMeta, isOverdue } from "./board-utils"

// Carte du studio : cover, statut, état de validation visible (attente,
// retours, approbation périmée), étiquettes éditables et sélection multiple.

function MetaBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warning" | "danger"
  icon: typeof Hourglass
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        tone === "warning" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  )
}

export function ContentCard({
  client,
  content,
  selected,
  onToggleSelect,
  allLabels,
  onLabelsChange,
  reviewMeta,
  onRemind,
}: {
  client: Client
  content: ContentItem
  selected: boolean
  onToggleSelect: () => void
  allLabels: string[]
  onLabelsChange: (labels: string[]) => void
  reviewMeta: CardReviewMeta
  onRemind: () => void
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const cover = content.media[0]
  const platforms = content.targets.map((tg) => tg.platform)
  const labels = content.labels ?? []
  const title = pick(content.title, locale)
  const late = isOverdue(content)

  return (
    <Link
      href={routes.content(client.id, content.id)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/20",
        selected && "border-primary ring-2 ring-primary/40"
      )}
    >
      <span
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className={cn(
          "absolute top-2 left-2 z-10 rounded-md bg-background/90 p-1 shadow-sm backdrop-blur-sm transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={t("studio.card.selectAria", { title })}
        />
      </span>

      {cover ? (
        <MediaThumb
          media={cover}
          alt={title}
          count={content.media.length}
          className="aspect-[4/3]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
          <FormatLabel format={content.format} className="text-sm" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
            {title}
          </p>
          {content.commentsCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
              <MessageSquare className="size-3.5" />
              {content.commentsCount}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ContentStatusBadge status={content.status} />
          <PlatformIcons platforms={platforms} />
        </div>

        {reviewMeta.waitDays !== null ||
        content.status === "changes_requested" ||
        content.approvalStale ||
        late ? (
          <div className="flex flex-wrap items-center gap-1">
            {reviewMeta.waitDays !== null ? (
              <MetaBadge tone="warning" icon={Hourglass}>
                {reviewMeta.waitDays >= 1
                  ? t("studio.card.waitSince", { days: reviewMeta.waitDays })
                  : t("studio.card.sentToday")}
              </MetaBadge>
            ) : null}
            {content.status === "changes_requested" ? (
              <MetaBadge tone="warning" icon={Undo2}>
                {t("studio.card.changesToHandle")}
              </MetaBadge>
            ) : null}
            {content.approvalStale ? (
              <MetaBadge tone="warning" icon={TriangleAlert}>
                {t("studio.card.approvalStale")}
              </MetaBadge>
            ) : null}
            {late ? (
              <MetaBadge tone="danger" icon={AlarmClock}>
                {t("studio.card.late")}
              </MetaBadge>
            ) : null}
          </div>
        ) : null}

        {labels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {labels.map((label) => {
              const text = pick(label, locale)
              return (
                <span
                  key={text}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: labelColorVar(text) }}
                  />
                  {text}
                </span>
              )
            })}
          </div>
        ) : null}

        {reviewMeta.canRemind ? (
          <span
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Button variant="outline" size="xs" onClick={onRemind}>
              <BellRing />
              {t("studio.card.remindClient")}
            </Button>
          </span>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <FormatLabel format={content.format} />
          <span className="flex items-center gap-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                !content.scheduledAt && "italic"
              )}
            >
              {content.scheduledAt ? (
                f.dateTime(content.scheduledAt, client.timezone)
              ) : (
                <>
                  <CalendarOff className="size-3.5" />
                  {t("studio.card.noDate")}
                </>
              )}
            </span>
            <CardLabelPopover
              title={title}
              labels={labels.map((l) => pick(l, locale))}
              allLabels={allLabels}
              onApply={onLabelsChange}
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
