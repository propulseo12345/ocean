"use client"

import { ChevronLeft, ChevronRight, Film } from "lucide-react"
import Image from "next/image"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import type { MediaAsset } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export function MediaCarousel({
  media,
  alt,
  index,
  onIndexChange,
  overlay,
}: {
  media: MediaAsset[]
  alt: string
  index: number
  onIndexChange: (next: number) => void
  /** Calque rendu par-dessus le média courant (ex. pins d'annotation). */
  overlay?: ReactNode
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
        <Image
          key={current.id}
          src={current.fullUrl}
          alt={total > 1 ? t("portal.carousel.altSlide", { alt, index: index + 1 }) : alt}
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          priority={index === 0}
          className="object-cover"
        />

        {overlay}

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
            <span className="absolute top-3 right-3 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-sm">
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

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const t = useT()
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={side === "left" ? t("portal.carousel.previous") : t("portal.carousel.next")}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        side === "left" ? "left-3" : "right-3"
      )}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  )
}
