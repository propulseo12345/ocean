"use client"

import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { ContentItem } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Zone média de l'aperçu natif : visuel courant + navigation de carrousel.

export function DetailPreviewMedia({
  content,
  vertical,
  slide,
  onSlide,
}: {
  content: ContentItem
  vertical: boolean
  slide: number
  onSlide: (next: number) => void
}) {
  const t = useT()
  const media = content.media
  const index = Math.min(slide, Math.max(media.length - 1, 0))
  const current = media[index]

  return (
    <div className={cn("relative w-full bg-muted", vertical ? "aspect-[9/16]" : "aspect-square")}>
      {current ? (
        <>
          <Image
            src={current.fullUrl}
            alt={current.altText ? current.altText : content.title}
            fill
            sizes="320px"
            className="object-cover"
          />
          {media.length > 1 ? (
            <>
              <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm">
                {index + 1}/{media.length}
              </span>
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={t("studio.media.prevVisual")}
                className="absolute top-1/2 left-1.5 -translate-y-1/2 rounded-full opacity-90"
                onClick={() => onSlide((index - 1 + media.length) % media.length)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={t("studio.media.nextVisual")}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full opacity-90"
                onClick={() => onSlide((index + 1) % media.length)}
              >
                <ChevronRight />
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <ImageOff className="size-5" />
          <span className="text-xs">{t("studio.media.none")}</span>
        </div>
      )}
    </div>
  )
}
