"use client"

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useState } from "react"
import { GridBoard } from "./grid-board"
import { GridHarmony } from "./grid-harmony"
import { GridLegend } from "./grid-legend"
import { GridShelf, ShelfCard } from "./grid-shelf"
import { GridTile } from "./grid-tile"
import type { GridRatio, GridTileData } from "./grid-types"
import {
  type InstagramProfileData,
  InstagramProfileHeader,
  type ProfileTab,
} from "./instagram-profile-header"
import { ReelsTab } from "./reels-tab"
import type { TileSelection } from "./sortable-grid-tile"
import type { QuickViewCtx } from "./tile-quick-view"
import type { GridTilesState } from "./use-grid-tiles"

// Espace de travail : profil simulé + onglets Publications/Reels, grille
// drag-and-drop (souris, clavier, long-press tactile), étagère et harmonie.

export function GridWorkspace({
  profile,
  tz,
  palette,
  reels,
  pinned,
  planned,
  published,
  imported,
  ratio,
  finalRender,
  syncing,
  isExcluded,
  ctx,
  selection,
  tiles,
}: {
  profile: InstagramProfileData
  tz: string
  palette: string[]
  reels: GridTileData[]
  pinned: GridTileData[]
  planned: GridTileData[]
  published: GridTileData[]
  imported: GridTileData[]
  ratio: GridRatio
  finalRender: boolean
  syncing: boolean
  isExcluded: (tile: GridTileData) => boolean
  ctx: QuickViewCtx
  selection: TileSelection
  tiles: GridTilesState
}) {
  const [tab, setTab] = useState<ProfileTab>("posts")

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press 250 ms sur tactile : le swipe scrolle, l'appui long drague (PWA iOS).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={tiles.onDragStart}
      onDragEnd={tiles.onDragEnd}
      onDragCancel={tiles.onDragCancel}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          {finalRender ? null : <GridLegend />}
          <div className="mx-auto w-full max-w-[468px] space-y-3 sm:mx-0">
            <InstagramProfileHeader
              profile={profile}
              activeTab={tab}
              onTabChange={setTab}
              reelsCount={reels.length}
            />
            {tab === "posts" ? (
              <GridBoard
                pinned={pinned}
                planned={planned}
                published={published}
                imported={imported}
                ratio={ratio}
                finalRender={finalRender}
                syncing={syncing}
                tz={tz}
                ctx={ctx}
                selection={selection}
              />
            ) : (
              <ReelsTab reels={reels} isExcluded={isExcluded} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <GridShelf tiles={tiles.shelf} />
          <GridHarmony palette={palette} />
        </div>
      </div>

      <DragOverlay>
        {tiles.activeTile ? (
          tiles.activeFromShelf ? (
            <div className="w-64">
              <ShelfCard tile={tiles.activeTile} dragging />
            </div>
          ) : (
            <GridTile tile={tiles.activeTile} ratio={ratio} dragging />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
