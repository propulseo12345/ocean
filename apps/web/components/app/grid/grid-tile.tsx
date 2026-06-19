import { Crop, Plus } from "lucide-react"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridRatio, GridTileData } from "./grid-types"
import { cropLoss, isSortableTile, RATIO_CLASS } from "./grid-types"
import { CropOverlay, TileBottomOverlay, TileTopOverlays } from "./tile-overlays"

export type { GridGroup, GridTileData } from "./grid-types"

/** Image affichée : la cover d'un Reel remplace la 1re frame, comme sur le vrai profil. */
function displayMedia(tile: GridTileData) {
  if (!tile.media) return null
  return tile.coverUrl ? { ...tile.media, thumbUrl: tile.coverUrl } : tile.media
}

function GhostTile({ tile }: { tile: GridTileData }) {
  const t = useT()
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed p-2 text-center"
      style={{
        borderColor: `color-mix(in oklch, ${tile.ghost?.colorVar} 55%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${tile.ghost?.colorVar} 12%, transparent)`,
      }}
    >
      <Plus className="size-4 text-muted-foreground" />
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">
        {tile.ghost?.label}
      </span>
      <span className="text-[10px] text-muted-foreground">{t("grid.tile.reserved")}</span>
    </div>
  )
}

function MediaFallback({ tile }: { tile: GridTileData }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted p-2 text-center text-muted-foreground">
      <FormatIcon format={tile.format} className="size-4" />
      <span className="line-clamp-3 text-[11px] font-medium leading-tight">{tile.title}</span>
    </div>
  )
}

export function GridTile({
  tile,
  ratio = "3:4",
  finalRender = false,
  dragging = false,
}: {
  tile: GridTileData
  ratio?: GridRatio
  finalRender?: boolean
  dragging?: boolean
}) {
  const t = useT()
  const media = displayMedia(tile)
  const sortable = isSortableTile(tile)
  const failed = tile.status === "failed"
  const publishing = tile.status === "publishing"
  const canceled = tile.status === "canceled"
  const cropped = !finalRender && sortable && !tile.ghost && cropLoss(tile.media, ratio) !== null

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-md bg-muted ring-offset-background transition-shadow",
        RATIO_CLASS[ratio],
        !finalRender && sortable && !tile.ghost && "ring-2 ring-primary/60",
        !finalRender && failed && "ring-2 ring-destructive/70",
        !finalRender && canceled && "opacity-60 grayscale",
        publishing && "opacity-80",
        dragging && "scale-105 shadow-lg"
      )}
    >
      {tile.ghost ? (
        <GhostTile tile={tile} />
      ) : media ? (
        <MediaThumb
          media={media}
          alt={tile.title}
          count={tile.mediaCount}
          className={cn("aspect-auto h-full w-full rounded-md", sortable && "opacity-90")}
        />
      ) : (
        <MediaFallback tile={tile} />
      )}

      {!finalRender && !tile.ghost ? <CropOverlay tile={tile} ratio={ratio} /> : null}

      <TileTopOverlays tile={tile} finalRender={finalRender} />

      {/* Badge recadrage : un média qui sera rogné sur le profil réel. */}
      {cropped ? (
        <span
          title={t("grid.tile.cropBadge", { ratio })}
          className="absolute bottom-8 left-1.5 z-10 rounded-full bg-warning/90 p-1 text-warning-foreground"
        >
          <Crop className="size-3" />
          <span className="sr-only">{t("grid.tile.croppedSr", { ratio })}</span>
        </span>
      ) : null}

      {finalRender || tile.ghost ? null : <TileBottomOverlay tile={tile} />}
    </div>
  )
}
