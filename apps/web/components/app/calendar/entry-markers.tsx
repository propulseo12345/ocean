"use client"

import { BellRing, Hand, Hourglass, Lock, MessageSquare, TriangleAlert } from "lucide-react"
import type { CSSProperties } from "react"
import { PlatformDot } from "@/components/shared/platform-badge"
import { contentStatusMeta, platformMeta } from "@/lib/mocks/labels"
import type { ContentItem, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { manualKindOf } from "./calendar-insights"
import { isMovable, lockReason } from "./calendar-schedule"
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
  const manual = manualKindOf(item)
  const waiting = ctx.waitingDays.get(item.id)
  const locked = !isMovable(item)

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {ctx.accountIssueIds.has(item.id) ? (
        <TriangleAlert
          className="size-3 text-warning"
          aria-label="Compte à reconnecter — risque d'échec"
        />
      ) : null}
      {item.status === "partially_published" ? (
        <TriangleAlert
          className="size-3 text-warning"
          aria-label={item.lastError ?? "Partiellement publié"}
        />
      ) : null}
      {manual === "tiktok" ? (
        <BellRing
          className="size-3 text-muted-foreground"
          aria-label="Brouillon TikTok — à finaliser dans l'app"
        />
      ) : null}
      {manual === "manual" ? (
        <Hand
          className="size-3 text-muted-foreground"
          aria-label="Publication manuelle (rappel à l'heure prévue)"
        />
      ) : null}
      {waiting !== undefined && waiting >= 1 ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning tabular-nums"
          title={`En attente de validation depuis ${waiting} j`}
        >
          <Hourglass className="size-3" aria-hidden />
          {waiting} j
        </span>
      ) : null}
      {item.commentsCount > 0 ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums"
          title={`${item.commentsCount} retour${item.commentsCount > 1 ? "s" : ""} client`}
        >
          <MessageSquare className="size-3" aria-hidden />
          {item.commentsCount}
        </span>
      ) : null}
      {item.approvalStale ? (
        <span
          className="size-1.5 rounded-full bg-warning"
          title="Approbation périmée — le contenu a changé depuis la validation"
        />
      ) : null}
      {locked ? (
        <Lock
          className="size-3 text-muted-foreground/70"
          aria-label={lockReason(item.status) ?? "Date verrouillée"}
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
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {platforms.slice(0, max).map((p, i) => (
        <span key={`${p}_${i}`} title={platformMeta[p].label}>
          <PlatformDot platform={p} />
          <span className="sr-only">{platformMeta[p].label}</span>
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
export function entryAriaLabel(item: ContentItem): string {
  return `${item.title} — ${contentStatusMeta[item.status].label}`
}
