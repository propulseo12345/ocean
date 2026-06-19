"use client"

import { useDroppable } from "@dnd-kit/core"
import Link from "next/link"
import { GridTile } from "@/components/app/grid/grid-tile"
import type { GridRatio, GridTileData } from "@/components/app/grid/grid-types"
import {
  type QuickViewCtx,
  TileInfoButton,
  TileQuickView,
} from "@/components/app/grid/tile-quick-view"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Tuile verrouillée (publié / importé) : non draggable, lecture seule.
// Droppable « interdit » : survoler en glissant affiche un anneau destructif
// au lieu d'ignorer le drop en silence (audit §1.2).
export function LockedGridTile({
  tile,
  ratio,
  finalRender,
  ctx,
}: {
  tile: GridTileData
  ratio: GridRatio
  finalRender: boolean
  ctx: QuickViewCtx
}) {
  const t = useT()
  const { setNodeRef, isOver, active } = useDroppable({
    id: `locked_${tile.id}`,
    data: { locked: true },
  })

  const inner = <GridTile tile={tile} ratio={ratio} finalRender={finalRender} />
  const linkClass =
    "block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  const content =
    tile.group === "imported" && tile.permalink ? (
      <a
        href={tile.permalink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("grid.lockedTile.viewOnInstagram", { title: tile.title })}
        className={linkClass}
        draggable={false}
      >
        {inner}
      </a>
    ) : tile.href ? (
      <Link
        href={tile.href}
        aria-label={t("grid.lockedTile.open", { title: tile.title })}
        className={linkClass}
      >
        {inner}
      </Link>
    ) : (
      <div>{inner}</div>
    )

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative",
        isOver && active && "rounded-md ring-2 ring-destructive/70 ring-offset-1"
      )}
    >
      <TileQuickView tile={tile} ctx={ctx} disabled={finalRender}>
        {content}
      </TileQuickView>
      {finalRender ? null : <TileInfoButton tile={tile} ctx={ctx} />}
    </div>
  )
}
