"use client"

import { Info } from "lucide-react"
import type { ReactElement } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import type { GridTileData } from "./grid-types"
import { QuickViewBody, type QuickViewCtx } from "./quick-view-body"

export type { QuickViewCtx } from "./quick-view-body"

// Fiche express d'une tuile : survol (desktop) ou bouton info (tactile).

/** Enveloppe une tuile d'une fiche express au survol (desktop). */
export function TileQuickView({
  tile,
  ctx,
  disabled = false,
  children,
}: {
  tile: GridTileData
  ctx: QuickViewCtx
  disabled?: boolean
  children: ReactElement
}) {
  if (disabled) return children
  return (
    <HoverCard>
      <HoverCardTrigger delay={350} closeDelay={120} render={children} />
      <HoverCardContent side="right" align="start" className="w-72">
        <QuickViewBody tile={tile} ctx={ctx} />
      </HoverCardContent>
    </HoverCard>
  )
}

/** Bouton info pour écrans tactiles (le survol n'existe pas, le long-press drague). */
export function TileInfoButton({ tile, ctx }: { tile: GridTileData; ctx: QuickViewCtx }) {
  const t = useT()
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("grid.quickView.detailsOf", { title: tile.title })}
            className="absolute right-1.5 bottom-8 z-20 hidden size-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm pointer-coarse:flex"
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <QuickViewBody tile={tile} ctx={ctx} />
      </PopoverContent>
    </Popover>
  )
}
