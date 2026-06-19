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
import { formatDateTime } from "@/lib/format"
import { platformMeta, targetStatusMeta } from "@/lib/mocks/labels"
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

function copyCaption(caption: string) {
  navigator.clipboard
    .writeText(caption)
    .then(() => toast.success("Légende copiée dans le presse-papiers"))
    .catch(() => toast.error("Impossible de copier la légende"))
}

const nf = new Intl.NumberFormat("fr-FR")

function MetricsRow({ tile }: { tile: GridTileData }) {
  if (!tile.metrics) return null
  const m = tile.metrics
  const items: { icon: typeof Heart; label: string; value: number }[] = [
    { icon: Heart, label: "J'aime", value: m.likes },
    { icon: MessageCircle, label: "Commentaires", value: m.comments },
    { icon: Eye, label: "Portée", value: m.reach },
    { icon: Bookmark, label: "Enregistrements", value: m.saves },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ icon: Icon, label, value }) => (
        <span key={label} title={label} className="inline-flex items-center gap-1 tabular-nums">
          <Icon className="size-3" />
          {nf.format(value)}
        </span>
      ))}
      {tile.isTopPost ? <Badge className="text-[10px]">Top du mois</Badge> : null}
    </div>
  )
}

export function QuickViewBody({ tile, ctx }: { tile: GridTileData; ctx: QuickViewCtx }) {
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
          {formatDateTime(tile.dateIso, tile.tz)} · fuseau client
        </p>
      ) : null}

      {tile.platforms && tile.platforms.length > 0 ? (
        <ul className="space-y-1">
          {tile.platforms.map((p) => (
            <li key={p.platform} className="flex items-center gap-1.5 text-xs">
              <PlatformIcon platform={p.platform} className="size-3.5" />
              <span>{platformMeta[p.platform].label}</span>
              <span
                className={cn(
                  "ml-auto text-muted-foreground",
                  p.status === "failed" && "font-medium text-destructive"
                )}
              >
                {targetStatusMeta[p.status].label}
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
        <p className="text-xs text-warning">Validation périmée — à refaire valider.</p>
      ) : null}

      <MetricsRow tile={tile} />

      <div className="space-y-1 border-t pt-2">
        {tile.href ? (
          <Button variant="ghost" size="sm" className={action} render={<Link href={tile.href} />}>
            <PenSquare /> Ouvrir dans le studio
          </Button>
        ) : null}
        {tile.permalink ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            render={<a href={tile.permalink} target="_blank" rel="noopener noreferrer" />}
          >
            <SquareArrowOutUpRight /> Voir sur Instagram
          </Button>
        ) : null}
        {tile.caption ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => copyCaption(tile.caption ?? "")}
          >
            <Copy /> Copier la légende
          </Button>
        ) : null}
        {tile.status === "failed" ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(action, "text-destructive")}
            onClick={() => ctx.onRetry(tile)}
          >
            <RotateCcw /> Reprogrammer
          </Button>
        ) : null}
        {isSortableTile(tile) && tile.dateIso && !tile.ghost ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => ctx.onInsertSlot(tile)}
          >
            <CalendarPlus /> Insérer un créneau avant
          </Button>
        ) : null}
        {isReel && tile.media ? (
          <Button
            variant="ghost"
            size="sm"
            className={action}
            onClick={() => ctx.onCompareCover(tile)}
          >
            <ImageIcon /> Tester la cover
          </Button>
        ) : null}
        {locked && tile.metrics ? (
          <Button variant="ghost" size="sm" className={action} onClick={() => ctx.onRecycle(tile)}>
            <Recycle /> Recycler ce contenu
          </Button>
        ) : null}
        {locked && !tile.ghost ? (
          <Button variant="ghost" size="sm" className={action} onClick={() => ctx.onHide(tile)}>
            <EyeOff /> Masquer de l'aperçu
          </Button>
        ) : null}
        {isReel && tile.group !== "imported" ? (
          <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm">
            <span>Afficher dans la grille</span>
            <Switch
              size="sm"
              aria-label="Afficher dans la grille"
              checked={!ctx.isExcluded(tile)}
              onCheckedChange={() => ctx.onToggleExcluded(tile)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
