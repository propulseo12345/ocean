"use client"

import { BellRing, Hand, Hourglass, Lock, MessageSquare, TriangleAlert } from "lucide-react"
import type { CSSProperties } from "react"
import { PlatformDot } from "@/components/shared/platform-badge"
import { type Labels, type Locale, pick, useLabels, useLocale, useT } from "@/lib/i18n"
import type { ContentItem, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { manualKindOf } from "./calendar-insights"
import { isMovable, lockReasonKey } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"

// Marqueurs d'état d'une carte : verrou, compte à reconnecter, canal manuel,
// retours client, approbation périmée, attente de validation.

export function EntryMarkers({
  item,
  ctx,
  className,
}: {
  item: ContentItem
  ctx: DayContext
  className?: string
}) {
  const t = useT()
  const { locale } = useLocale()
  const manual = manualKindOf(item)
  const waiting = ctx.waitingDays.get(item.id)
  const locked = !isMovable(item)
  const lockKey = locked ? lockReasonKey(item.status) : null

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {ctx.accountIssueIds.has(item.id) ? (
        <TriangleAlert
          className="size-3 text-warning"
          aria-label={t("calendar.markers.reconnectRisk")}
        />
      ) : null}
      {item.status === "partially_published" ? (
        <TriangleAlert
          className="size-3 text-warning"
          aria-label={
            item.lastError ? pick(item.lastError, locale) : t("calendar.markers.partiallyPublished")
          }
        />
      ) : null}
      {manual === "tiktok" ? (
        <BellRing
          className="size-3 text-muted-foreground"
          aria-label={t("calendar.markers.tiktokDraft")}
        />
      ) : null}
      {manual === "manual" ? (
        <Hand
          className="size-3 text-muted-foreground"
          aria-label={t("calendar.markers.manualPublish")}
        />
      ) : null}
      {waiting !== undefined && waiting >= 1 ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning tabular-nums"
          title={t("calendar.markers.waitingTitle", { days: waiting })}
        >
          <Hourglass className="size-3" aria-hidden />
          {t("calendar.markers.waitingDays", { days: waiting })}
        </span>
      ) : null}
      {item.commentsCount > 0 ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums"
          title={t("calendar.markers.commentsTitle", { count: item.commentsCount })}
        >
          <MessageSquare className="size-3" aria-hidden />
          {item.commentsCount}
        </span>
      ) : null}
      {item.approvalStale ? (
        <span
          className="size-1.5 rounded-full bg-warning"
          title={t("calendar.markers.approvalStale")}
        />
      ) : null}
      {locked ? (
        <Lock
          className="size-3 text-muted-foreground/70"
          aria-label={lockKey ? t(lockKey) : t("calendar.markers.lockedDefault")}
        />
      ) : null}
    </span>
  )
}

/** Pastilles plateformes avec libellé accessible (titre + sr-only). */
export function PlatformDots({
  platforms,
  max = 3,
  className,
}: {
  platforms: Platform[]
  max?: number
  className?: string
}) {
  const lbl = useLabels()
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {platforms.slice(0, max).map((p, i) => (
        <span key={`${p}_${i}`} title={lbl.platform(p)}>
          <PlatformDot platform={p} />
          <span className="sr-only">{lbl.platform(p)}</span>
        </span>
      ))}
    </span>
  )
}

/** Liseré gauche couleur du pilier (ou transparent si aucun pilier). */
export function pillarEdgeStyle(item: ContentItem, ctx: DayContext): CSSProperties | undefined {
  const pillar = item.pillarId ? ctx.pillarById.get(item.pillarId) : undefined
  return pillar ? { borderLeftColor: pillar.colorVar } : undefined
}

/** Classes communes d'une carte selon son statut (échec saillant). */
export function entryToneClass(item: ContentItem): string {
  if (item.status === "failed") {
    return "border-destructive/50 bg-destructive/10 hover:bg-destructive/15"
  }
  if (item.status === "canceled") return "opacity-60 bg-muted/40 hover:bg-muted"
  return "bg-muted/60 hover:bg-muted"
}

/** Libellé d'accessibilité complet d'une carte. */
export function entryAriaLabel(
  item: ContentItem,
  lbl: Labels,
  locale: Locale,
  t: ReturnType<typeof useT>
): string {
  return t("calendar.markers.ariaLabel", {
    title: pick(item.title, locale),
    status: lbl.contentStatus(item.status),
  })
}
