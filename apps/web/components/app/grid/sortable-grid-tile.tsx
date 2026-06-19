"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check } from "lucide-react"
import Link from "next/link"
import { GridTile } from "@/components/app/grid/grid-tile"
import type { GridRatio, GridTileData } from "@/components/app/grid/grid-types"
import { isSortableTile } from "@/components/app/grid/grid-types"
import {
  type QuickViewCtx,
  TileInfoButton,
  TileQuickView,
} from "@/components/app/grid/tile-quick-view"
import { cn } from "@/lib/utils"

export interface TileSelection {
  active: boolean
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
}

// Tuile de la zone planifiée : draggable (permutation des dates), clic = studio,
// fiche express au survol, case à cocher en mode sélection.
export function SortableGridTile({
  tile,
  ratio,
  finalRender,
  ctx,
  selection,
}: {
  tile: GridTileData
  ratio: GridRatio
  finalRender: boolean
  ctx: QuickViewCtx
  selection: TileSelection
}) {
  const draggable = isSortableTile(tile) && !selection.active && !finalRender
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tile.id,
    disabled: !draggable,
  })

  const selectable = selection.active && isSortableTile(tile) && !tile.ghost
  const selected = selectable && selection.isSelected(tile.id)

  const inner = <GridTile tile={tile} ratio={ratio} finalRender={finalRender} />

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // touch-manipulation (et non touch-none) : le swipe scrolle, le long-press drague.
      className={cn("relative touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {selectable ? (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${selected ? "Désélectionner" : "Sélectionner"} ${tile.title}`}
          onClick={() => selection.onToggle(tile.id)}
          className={cn(
            "block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          {inner}
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 right-1.5 z-20 flex size-5 items-center justify-center rounded-full border-2 border-white/90 bg-black/40",
              selected && "border-primary bg-primary"
            )}
          >
            {selected ? <Check className="size-3 text-primary-foreground" /> : null}
          </span>
        </button>
      ) : (
        <>
          <TileQuickView tile={tile} ctx={ctx} disabled={finalRender}>
            {tile.href ? (
              <Link
                href={tile.href}
                aria-label={`Ouvrir ${tile.title}`}
                // Le clic n'est suivi que s'il n'y a pas eu de drag (dnd-kit absorbe le drag).
                className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                draggable={false}
              >
                {inner}
              </Link>
            ) : (
              <div>{inner}</div>
            )}
          </TileQuickView>
          {finalRender ? null : <TileInfoButton tile={tile} ctx={ctx} />}
        </>
      )}
    </div>
  )
}
