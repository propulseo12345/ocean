"use client"

import { ImageOff, MapPin } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { MediaCarousel } from "@/components/portal/media-carousel"
import { Button } from "@/components/ui/button"
import type { Comment, ContentFormat, MediaAsset } from "@/lib/domain"
import { useFormat, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { DetailCoverDialog } from "./detail-cover-dialog"

// Visionneuse studio : carrousel (composant du portail) + épingles
// d'annotation posées par le client, synchronisées avec leurs remarques.
// Pour les Reels : choix de la couverture (dialog, état local — aperçu).
// Le titre arrive déjà résolu (string) ; les commentaires (string) sont
// résolus ici avec la locale active.

export function ContentDetailMedia({
  media,
  title,
  comments,
  format,
  coverUrl,
}: {
  media: MediaAsset[]
  title: string
  comments: Comment[]
  format: ContentFormat
  coverUrl?: string
}) {
  const t = useT()
  const f = useFormat()
  const [slideIndex, setSlideIndex] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [coverLabel, setCoverLabel] = useState(
    coverUrl ? t("studio.media.coverDedicated") : t("studio.media.coverFirstFrame")
  )
  const [coverOpen, setCoverOpen] = useState(false)

  const pinned = comments.filter((c) => c.annotation)
  const slidePins = pinned.filter((c) => (c.annotation?.slideIndex ?? 0) === slideIndex)
  const active = pinned.find((c) => c.id === activeId) ?? null
  const video = media.find((m) => m.type === "video") ?? null
  const isReel = format === "reel" && video !== null

  if (media.length === 0) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
        <ImageOff className="size-7" />
        <p className="text-sm">{t("studio.media.none")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <MediaCarousel
        media={media}
        alt={title}
        index={slideIndex}
        onIndexChange={(next) => {
          setSlideIndex(next)
          setActiveId(null)
        }}
        overlay={slidePins.map((c) => (
          <AnnotationPin
            key={c.id}
            label={pinned.findIndex((p) => p.id === c.id) + 1}
            x={c.annotation?.x ?? 0}
            y={c.annotation?.y ?? 0}
            active={activeId === c.id}
            onClick={() => setActiveId(activeId === c.id ? null : c.id)}
          />
        ))}
      />

      {active ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/85 text-[10px] font-semibold text-primary-foreground">
              {pinned.findIndex((p) => p.id === active.id) + 1}
            </span>
            <span className="text-xs font-medium">{active.authorName}</span>
            <span className="text-[11px] text-muted-foreground">
              {f.relative(active.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{active.body}</p>
        </div>
      ) : pinned.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {t("studio.media.pinnedNote", { count: pinned.length })}
        </p>
      ) : null}

      {isReel && video ? (
        <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
          <span className="relative block h-12 w-9 shrink-0 overflow-hidden rounded-md border">
            <Image
              src={coverUrl ?? video.thumbUrl}
              alt={t("studio.media.reelCover")}
              fill
              sizes="36px"
              className="object-cover"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">{t("studio.media.reelCover")}</p>
            <p className="truncate text-[11px] text-muted-foreground">{coverLabel}</p>
          </div>
          <Button size="xs" variant="outline" onClick={() => setCoverOpen(true)}>
            {t("studio.media.choose")}
          </Button>
          <DetailCoverDialog
            open={coverOpen}
            onOpenChange={setCoverOpen}
            video={video}
            coverUrl={coverUrl}
            onSelect={setCoverLabel}
          />
        </div>
      ) : null}
    </div>
  )
}

function AnnotationPin({
  label,
  x,
  y,
  active,
  onClick,
}: {
  label: number
  x: number
  y: number
  active: boolean
  onClick: () => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      aria-label={t("studio.media.pinAria", { label })}
      onClick={onClick}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={cn(
        "absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-primary-foreground shadow-md transition-transform",
        active ? "scale-125 bg-primary" : "bg-primary/85 hover:scale-110"
      )}
    >
      {label}
    </button>
  )
}
