"use client"

import { Clapperboard, EyeOff, Play } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { useFormat, useLabels, useT } from "@/lib/i18n"
import { contentStatusMeta, toneDotClass } from "@/lib/mocks/labels"
import { cn } from "@/lib/utils"
import type { GridTileData } from "./grid-types"

// Onglet Reels du profil simulé : grille de covers 9:16, dans son ordre propre,
// pour juger l'esthétique de la vitrine Reels séparément du feed principal.

function ReelTile({ tile, excluded }: { tile: GridTileData; excluded: boolean }) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const src = tile.coverUrl ?? tile.media?.thumbUrl
  const planned = tile.group === "scheduled"

  const inner = (
    <div
      className={cn(
        "group relative aspect-[9/16] overflow-hidden rounded-md bg-muted",
        planned && "ring-2 ring-primary/60"
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={tile.title}
          fill
          sizes="(max-width: 768px) 33vw, 156px"
          className="object-cover"
        />
      ) : null}

      {planned && tile.status ? (
        <span
          title={lbl.contentStatus(tile.status)}
          className="absolute top-1.5 left-1.5 flex items-center rounded-full bg-black/55 p-1 backdrop-blur-sm"
        >
          <span
            className={cn("size-2 rounded-full", toneDotClass[contentStatusMeta[tile.status].tone])}
          />
          <span className="sr-only">{lbl.contentStatus(tile.status)}</span>
        </span>
      ) : null}

      {excluded ? (
        <span
          title={t("grid.reels.offGridHint")}
          className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
        >
          <EyeOff className="size-3" />
          {t("grid.reels.offGrid")}
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/65 to-transparent p-1.5 text-white">
        <Play className="size-3 fill-current" />
        <span className="text-[11px] font-medium tabular-nums">
          {tile.metrics ? f.followers(tile.metrics.reach) : "—"}
        </span>
      </div>
    </div>
  )

  const linkClass =
    "block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  if (tile.group === "imported" && tile.permalink) {
    return (
      <a
        href={tile.permalink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("grid.reels.viewOnInstagram", { title: tile.title })}
        className={linkClass}
      >
        {inner}
      </a>
    )
  }
  if (tile.href) {
    return (
      <Link
        href={tile.href}
        aria-label={t("grid.reels.open", { title: tile.title })}
        className={linkClass}
      >
        {inner}
      </Link>
    )
  }
  return inner
}

export function ReelsTab({
  reels,
  isExcluded,
}: {
  reels: GridTileData[]
  isExcluded: (tile: GridTileData) => boolean
}) {
  const t = useT()
  if (reels.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title={t("grid.reels.emptyTitle")}
        description={t("grid.reels.emptyDescription")}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1">
        {reels.map((tile) => (
          <ReelTile key={tile.id} tile={tile} excluded={isExcluded(tile)} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("grid.reels.footnote")}</p>
    </div>
  )
}
