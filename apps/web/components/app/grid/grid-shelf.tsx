"use client"

import { useDraggable } from "@dnd-kit/core"
import { GripVertical, Lightbulb } from "lucide-react"
import Link from "next/link"
import type { GridTileData } from "@/components/app/grid/grid-types"
import { SHELF_PREFIX } from "@/components/app/grid/grid-types"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { useLabels, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** Carte d'étagère (aussi rendue en fantôme dans le DragOverlay). */
export function ShelfCard({ tile, dragging = false }: { tile: GridTileData; dragging?: boolean }) {
  const t = useT()
  const lbl = useLabels()
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-lg border bg-card p-2 transition-colors hover:border-primary/40",
        dragging && "shadow-lg"
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      <span className="size-11 shrink-0 overflow-hidden rounded-md">
        {tile.media ? (
          <MediaThumb
            media={tile.media}
            alt={tile.title}
            count={tile.mediaCount}
            className="rounded-md"
            sizes="44px"
          />
        ) : (
          // Les idées sans média ont enfin une vignette (audit §1.2).
          <span className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FormatIcon format={tile.format} className="size-4" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <FormatIcon format={tile.format} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{tile.title}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {tile.status ? `${lbl.contentStatus(tile.status)} · ` : ""}
          {t("grid.shelf.noDate")}
        </span>
      </span>
    </span>
  )
}

function ShelfItem({ tile }: { tile: GridTileData }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${SHELF_PREFIX}${tile.id}`,
  })

  return (
    <li
      ref={setNodeRef}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {tile.href ? (
        <Link
          href={tile.href}
          aria-label={t("grid.shelf.openInStudio", { title: tile.title })}
          draggable={false}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ShelfCard tile={tile} />
        </Link>
      ) : (
        <ShelfCard tile={tile} />
      )}
    </li>
  )
}

// Étagère latérale : idées / brouillons non datés, draggables vers la grille
// (date mockée attribuée à l'insertion) et cliquables vers le studio.
export function GridShelf({ tiles }: { tiles: GridTileData[] }) {
  const t = useT()
  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Lightbulb className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold">{t("grid.shelf.title")}</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{tiles.length}</span>
      </div>
      {tiles.length === 0 ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">{t("grid.shelf.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {tiles.map((tile) => (
            <ShelfItem key={tile.id} tile={tile} />
          ))}
        </ul>
      )}
      <p className="mt-2.5 px-1 text-[11px] leading-snug text-muted-foreground">
        {t("grid.shelf.footnote")}
      </p>
    </div>
  )
}
