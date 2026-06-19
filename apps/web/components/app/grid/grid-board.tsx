"use client"

import { useDroppable } from "@dnd-kit/core"
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { LockedGridTile } from "@/components/app/grid/locked-grid-tile"
import { SortableGridTile, type TileSelection } from "@/components/app/grid/sortable-grid-tile"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDayMonth } from "@/lib/format"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { GridRatio, GridTileData } from "./grid-types"
import { GRID_DROP_ID, isSortableTile, RATIO_CLASS } from "./grid-types"
import type { QuickViewCtx } from "./tile-quick-view"

// La grille 3 colonnes : épinglés (simulation), zone planifiée triable,
// séparateur « Aujourd'hui », puis feed réel verrouillé (publiés + importés).

function TodaySeparator({ tz }: { tz: string }) {
  return (
    <div className="col-span-3 flex items-center gap-2 py-0.5">
      <span className="h-px flex-1 bg-primary/40" />
      <span className="text-[11px] font-medium text-primary">
        Aujourd'hui · {formatDayMonth(MOCK_NOW.toISOString(), tz)}
      </span>
      <span className="h-px flex-1 bg-primary/40" />
    </div>
  )
}

export function GridBoard({
  pinned,
  planned,
  published,
  imported,
  ratio,
  finalRender,
  syncing,
  tz,
  ctx,
  selection,
}: {
  pinned: GridTileData[]
  planned: GridTileData[]
  published: GridTileData[]
  imported: GridTileData[]
  ratio: GridRatio
  finalRender: boolean
  syncing: boolean
  tz: string
  ctx: QuickViewCtx
  selection: TileSelection
}) {
  // Zone droppable de secours : permet le dépôt d'une carte d'étagère même
  // quand la zone planifiée est vide.
  const { setNodeRef } = useDroppable({ id: GRID_DROP_ID })

  const sortableIds = planned.filter(isSortableTile).map((t) => t.id)
  const hasLocked = pinned.length + published.length + imported.length > 0
  const showSeparator = !finalRender && planned.length > 0 && hasLocked

  return (
    <div ref={setNodeRef} className="grid grid-cols-3 gap-1">
      {pinned.map((tile) => (
        <LockedGridTile
          key={tile.id}
          tile={tile}
          ratio={ratio}
          finalRender={finalRender}
          ctx={ctx}
        />
      ))}

      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        {planned.map((tile) => (
          <SortableGridTile
            key={tile.id}
            tile={tile}
            ratio={ratio}
            finalRender={finalRender}
            ctx={ctx}
            selection={selection}
          />
        ))}
      </SortableContext>

      {showSeparator ? <TodaySeparator tz={tz} /> : null}

      {published.map((tile) => (
        <LockedGridTile
          key={tile.id}
          tile={tile}
          ratio={ratio}
          finalRender={finalRender}
          ctx={ctx}
        />
      ))}

      {syncing
        ? imported.map((tile) => <Skeleton key={tile.id} className={RATIO_CLASS[ratio]} />)
        : imported.map((tile) => (
            <LockedGridTile
              key={tile.id}
              tile={tile}
              ratio={ratio}
              finalRender={finalRender}
              ctx={ctx}
            />
          ))}
    </div>
  )
}
