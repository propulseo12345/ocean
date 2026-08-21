"use client"

import { ChevronLeft, ChevronRight, Film } from "lucide-react"
import type { ReactNode } from "react"
import { MediaFrame } from "@/components/shared/media-frame"
import { Button } from "@/components/ui/button"
import type { MediaAsset } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function MediaCarousel({
  media,
  alt,
  index,
  onIndexChange,
  overlay,
  picking = false,
  onPickPoint,
}: {
  media: MediaAsset[]
  alt: string
  index: number
  onIndexChange: (next: number) => void
  /** Calque rendu par-dessus le média courant (ex. pins d'annotation). */
  overlay?: ReactNode
  /** Mode « placer un repère » : le cadre devient une cible de clic. */
  picking?: boolean
  /** Point choisi, en fraction 0..1 du cadre (contrat de annotation_x/y). */
  onPickPoint?: (point: { x: number; y: number }) => void
}) {
  const t = useT()
  const total = media.length
  const current = media[index]
  if (!current) return null

  const go = (delta: number) => {
    const next = (index + delta + total) % total
    onIndexChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
        <MediaFrame
          media={current}
          alt={total > 1 ? t("portal.carousel.altSlide", { alt, index: index + 1 }) : alt}
          sizes="(max-width: 768px) 100vw, 640px"
          priority={index === 0}
        />

        {overlay}

        {picking && onPickPoint ? (
          <button
            type="button"
            aria-label={t("portal.carousel.pickPoint")}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              // detail === 0 → activation clavier (Entrée/Espace) : aucune
              // coordonnée de pointeur, on épingle au centre du visuel.
              onPickPoint(
                e.detail === 0
                  ? { x: 0.5, y: 0.5 }
                  : {
                      x: clamp01((e.clientX - rect.left) / rect.width),
                      y: clamp01((e.clientY - rect.top) / rect.height),
                    }
              )
            }}
            className="absolute inset-0 z-20 cursor-crosshair bg-primary/10 ring-2 ring-primary ring-inset transition-colors hover:bg-primary/15"
          />
        ) : null}

        {current.type === "video" ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <Film className="size-3.5" />
            {t("portal.carousel.video")}
          </span>
        ) : null}

        {total > 1 ? (
          <>
            <CarouselArrow side="left" onClick={() => go(-1)} />
            <CarouselArrow side="right" onClick={() => go(1)} />
            <span className="absolute top-3 right-3 z-30 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="flex items-center justify-center gap-1.5">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={t("portal.carousel.viewSlide", { index: i + 1 })}
              aria-current={i === index}
              onClick={() => onIndexChange(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const t = useT()
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={side === "left" ? t("portal.carousel.previous") : t("portal.carousel.next")}
      onClick={onClick}
      className={cn(
        // z-30 : reste cliquable au-dessus du calque de placement de repère.
        "absolute top-1/2 z-30 -translate-y-1/2 rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        side === "left" ? "left-3" : "right-3"
      )}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  )
}
