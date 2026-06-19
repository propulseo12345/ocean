"use client"

import {
  Bookmark,
  CalendarClock,
  CalendarPlus,
  Copy,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  PenSquare,
  Recycle,
  RotateCcw,
  SquareArrowOutUpRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  INTL_LOCALE,
  type Labels,
  type Translator,
  useFormat,
  useLabels,
  useLocale,
  useT,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridTileData } from "./grid-types"
import { isSortableTile } from "./grid-types"

// Contenu de la fiche express d'une tuile (partagé survol / popover tactile).

export interface QuickViewCtx {
  pillars: Record<string, { label: string; colorVar: string }>
  isExcluded: (tile: GridTileData) => boolean
  onToggleExcluded: (tile: GridTileData) => void
  onCompareCover: (tile: GridTileData) => void
  onInsertSlot: (tile: GridTileData) => void
  onHide: (tile: GridTileData) => void
  onRetry: (tile: GridTileData) => void
  onRecycle: (tile: GridTileData) => void
}

function copyCaption(caption: string, t: Translator) {
  navigator.clipboard
    .writeText(caption)
    .then(() => toast.success(t("grid.quickView.captionCopied")))
    .catch(() => toast.error(t("grid.quickView.captionCopyError")))
}

function MetricsRow({ tile }: { tile: GridTileData }) {
  const t = useT()
  const { locale } = useLocale()
  if (!tile.metrics) return null
  const m = tile.metrics
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale])
  const items: { icon: typeof Heart; label: string; value: number }[] = [
    { icon: Heart, label: t("grid.quickView.likes"), value: m.likes },
    { icon: MessageCircle, label: t("grid.quickView.comments"), value: m.comments },
    { icon: Eye, label: t("grid.quickView.reach"), value: m.reach },
    { icon: Bookmark, label: t("grid.quickView.saves"), value: m.saves },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ icon: Icon, label, value }) => (
        <span key={label} title={label} className="inline-flex items-center gap-1 tabular-nums">
          <Icon className="size-3" />
          {nf.format(value)}
        </span>
      ))}
      {tile.isTopPost ? <Badge className="text-[10px]">{t("grid.quickView.topPost")}</Badge> : null}
    </div>
  )
}

export function QuickViewBody({ tile, ctx }: { tile: GridTileData; ctx: QuickViewCtx }) {
  const t = useT()
  const f = useFormat()
  const lbl: Labels = useLabels()
  const pillar = tile.pillarId ? ctx.pillars[tile.pillarId] : undefined
  const isReel = tile.format === "reel" && !tile.ghost
  const locked = tile.group !== "scheduled"
  const action = "w-full justify-start"

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <p className="font-medium leading-snug">{tile.title}</p>
        {tile.status ? <ContentStatusBadge status={tile.status} /> : null}
      </div>

      {tile.dateIso ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          {f.dateTime(tile.dateIso, tile.tz)} · {t("grid.quickView.timezoneClient")}
        </p>
      ) : null}

      {tile.platforms && tile.platforms.length > 0 ? (
        <ul className="space-y-1">
          {tile.platforms.map((p) => (
            <li key={p.platform} className="flex items-center gap-1.5 text-xs">
              <PlatformIcon platform={p.platform} className="size-3.5" />
              <span>{lbl.platform(p.platform)}</span>
              <span
                className={cn(
                  "ml-auto text-muted-foreground",
                  p.status === "failed" && "font-medium text-destructive"
                )}
              >
                {lbl.targetStatus(p.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pillar ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: pillar.colorVar }}
          />
          {pillar.label}
        </p>
      ) : null}

      {tile.lastError ? <p className="text-xs text-destructive">{tile.lastError}</p> : null}
      {tile.approvalStale ? (
        <p className="text-xs text-warning">{t("grid.quickView.approvalStale")}</p>
      ) : null}

      <MetricsRow tile={tile} />

      <div className="space-y-1 border-t pt-2">
        {tile.href ? (
          <Button variant="ghost" size="sm" className={action} render={<Link href={tile.href} />}>
            <PenSquare /> {t("grid.quickView.openInStudio")}
          </Button>
        ) : null}
        {tile.permalink ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            render={<a href={tile.permalink} target="_blank" rel="noopener noreferrer" />}
          >
            <SquareArrowOutUpRight /> {t("grid.quickView.viewOnInstagram")}
          </Button>
        ) : null}
        {tile.caption ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => copyCaption(tile.caption ?? "", t)}
          >
            <Copy /> {t("grid.quickView.copyCaption")}
          </Button>
        ) : null}
        {tile.status === "failed" ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(action, "text-destructive")}
            onClick={() => ctx.onRetry(tile)}
          >
            <RotateCcw /> {t("grid.quickView.reschedule")}
          </Button>
        ) : null}
        {isSortableTile(tile) && tile.dateIso && !tile.ghost ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => ctx.onInsertSlot(tile)}
          >
            <CalendarPlus /> {t("grid.quickView.insertSlot")}
          </Button>
        ) : null}
        {isReel && tile.media ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => ctx.onCompareCover(tile)}
          >
            <ImageIcon /> {t("grid.quickView.testCover")}
          </Button>
        ) : null}
        {locked && tile.metrics ? (
          <Button variant="ghost" size="sm" className={action} onClick={() => ctx.onRecycle(tile)}>
            <Recycle /> {t("grid.quickView.recycle")}
          </Button>
        ) : null}
        {locked && !tile.ghost ? (
          <Button variant="ghost" size="sm" className={action} onClick={() => ctx.onHide(tile)}>
            <EyeOff /> {t("grid.quickView.hide")}
          </Button>
        ) : null}
        {isReel && tile.group !== "imported" ? (
          <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm">
            <span>{t("grid.quickView.showInGrid")}</span>
            <Switch
              size="sm"
              aria-label={t("grid.quickView.showInGrid")}
              checked={!ctx.isExcluded(tile)}
              onCheckedChange={() => ctx.onToggleExcluded(tile)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
