import { Ban, History, Loader2, Lock, MessageCircle, Pin, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { FormatIcon } from "@/components/shared/format-icon"
import { PlatformIcon } from "@/components/shared/platform-badge"
import type { ContentStatus } from "@/lib/domain"
import { contentStatusMeta, toneDotClass } from "@/lib/domain/labels"
import { type Labels, type Translator, useFormat, useLabels, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridTileData } from "./grid-types"
import { cropLoss, type GridRatio } from "./grid-types"

// Surcouches d'une tuile : statut, épinglé, alertes, recadrage, date+plateformes.
// Le noir/blanc translucide est le chrome standard des overlays photo (cf. MediaThumb).

const CHIP = "flex items-center gap-1 rounded-full bg-black/55 p-1 text-white backdrop-blur-sm"

function StatusChip({ status }: { status: ContentStatus }) {
  const lbl = useLabels()
  const { tone } = contentStatusMeta[status]
  const label = lbl.contentStatus(status)
  return (
    <span title={label} className={CHIP}>
      <span className={cn("size-2 rounded-full", toneDotClass[tone])} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function failedPlatformsLabel(tile: GridTileData, t: Translator, lbl: Labels): string {
  const failed = (tile.platforms ?? [])
    .filter((p) => p.status === "failed")
    .map((p) => lbl.platform(p.platform))
  return failed.length > 0
    ? t("grid.tile.failedPlatforms", { platforms: failed.join(", ") })
    : t("grid.tile.partialFailure")
}

/** Pile d'indicateurs en haut-gauche de la tuile. */
export function TileTopOverlays({
  tile,
  finalRender,
}: {
  tile: GridTileData
  finalRender: boolean
}) {
  const t = useT()
  const lbl = useLabels()
  const pin = tile.pinned ? (
    <span title={t("grid.tile.pinned")} className={CHIP}>
      <Pin className="size-3" />
      <span className="sr-only">{t("grid.tile.pinnedSr")}</span>
    </span>
  ) : null

  // En rendu final, seuls les marqueurs visibles sur le vrai profil restent.
  if (finalRender) return pin ? <Overlay>{pin}</Overlay> : null

  const chips: ReactNode[] = []
  if (pin) chips.push(<span key="pin">{pin}</span>)

  if (tile.group === "imported") {
    chips.push(
      <span key="lock" title={t("grid.tile.importedLocked")} className={CHIP}>
        <Lock className="size-3" />
        <span className="sr-only">{t("grid.tile.importedSr")}</span>
      </span>
    )
  }

  if (tile.status === "failed") {
    chips.push(
      <span
        key="failed"
        title={tile.lastError ?? t("grid.tile.publishFailed")}
        className={cn(CHIP, "bg-destructive/90")}
      >
        <TriangleAlert className="size-3" />
        <span className="sr-only">{t("grid.tile.publishFailedSr")}</span>
      </span>
    )
  } else if (tile.status === "publishing") {
    chips.push(
      <span key="publishing" title={t("grid.tile.publishing")} className={CHIP}>
        <Loader2 className="size-3 animate-spin" />
        <span className="sr-only">{t("grid.tile.publishingSr")}</span>
      </span>
    )
  } else if (tile.status === "canceled") {
    chips.push(
      <span key="canceled" title={t("grid.tile.canceled")} className={CHIP}>
        <Ban className="size-3" />
        <span className="sr-only">{t("grid.tile.canceledSr")}</span>
      </span>
    )
  } else if (tile.status === "partially_published") {
    chips.push(
      <span
        key="partial"
        title={failedPlatformsLabel(tile, t, lbl)}
        className={cn(CHIP, "bg-warning/90 text-warning-foreground")}
      >
        <TriangleAlert className="size-3" />
        <span className="sr-only">{failedPlatformsLabel(tile, t, lbl)}</span>
      </span>
    )
  } else if (tile.group === "scheduled" && tile.status && !tile.ghost) {
    chips.push(<StatusChip key="status" status={tile.status} />)
  } else if (tile.group === "published" && tile.status) {
    chips.push(<StatusChip key="status" status={tile.status} />)
  }

  if (tile.approvalStale) {
    chips.push(
      <span
        key="stale"
        title={t("grid.tile.approvalStale")}
        className={cn(CHIP, "bg-warning/90 text-warning-foreground")}
      >
        <History className="size-3" />
        <span className="sr-only">{t("grid.tile.approvalStaleSr")}</span>
      </span>
    )
  }
  if (tile.commentsCount && tile.commentsCount > 0) {
    chips.push(
      <span
        key="comments"
        title={t("grid.tile.comments", { count: tile.commentsCount })}
        className={cn(CHIP, "px-1.5 text-[10px] font-medium tabular-nums")}
      >
        <MessageCircle className="size-3" />
        {tile.commentsCount}
      </span>
    )
  }

  return chips.length > 0 ? <Overlay>{chips}</Overlay> : null
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute top-1.5 left-1.5 z-10 flex flex-col items-start gap-1">
      {children}
    </div>
  )
}

/** Bandeau bas : date/heure (fuseau client), plateformes secondaires, format. */
export function TileBottomOverlay({ tile }: { tile: GridTileData }) {
  const f = useFormat()
  const extraPlatforms = (tile.platforms ?? []).filter((p) => p.platform !== "instagram")
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent p-1.5 text-white">
      <span className="min-w-0 text-[11px] font-medium leading-tight tabular-nums">
        {tile.dateIso ? (
          <>
            <span className="block truncate">{f.dayMonth(tile.dateIso, tile.tz)}</span>
            <span className="block truncate text-white/80">{f.time(tile.dateIso, tile.tz)}</span>
          </>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {extraPlatforms.map((p) => (
          <PlatformIcon key={p.platform} platform={p.platform} className="size-3 drop-shadow" />
        ))}
        <FormatIcon format={tile.format} className="size-3.5 shrink-0 drop-shadow" />
      </span>
    </div>
  )
}

/** Zones perdues au recadrage (visibles au survol/focus de la tuile). */
export function CropOverlay({ tile, ratio }: { tile: GridTileData; ratio: GridRatio }) {
  const t = useT()
  const loss = cropLoss(tile.media, ratio)
  if (!loss) return null
  const size = `${(loss.perSide * 100).toFixed(1)}%`
  const band =
    "absolute bg-warning/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      title={t("grid.tile.cropOverlay", { ratio, size })}
    >
      {loss.axis === "x" ? (
        <>
          <span
            className={cn(band, "inset-y-0 left-0 border-r border-dashed border-warning")}
            style={{ width: size }}
          />
          <span
            className={cn(band, "inset-y-0 right-0 border-l border-dashed border-warning")}
            style={{ width: size }}
          />
        </>
      ) : (
        <>
          <span
            className={cn(band, "inset-x-0 top-0 border-b border-dashed border-warning")}
            style={{ height: size }}
          />
          <span
            className={cn(band, "inset-x-0 bottom-0 border-t border-dashed border-warning")}
            style={{ height: size }}
          />
        </>
      )}
    </div>
  )
}
