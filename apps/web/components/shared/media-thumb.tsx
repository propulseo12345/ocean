"use client"

import { Film, Layers } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import type { MediaAsset } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export function MediaThumb({
  media,
  alt,
  count,
  className,
  sizes = "(max-width: 768px) 33vw, 220px",
  priority = false,
}: {
  media: MediaAsset
  alt: string
  count?: number
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-muted", className)}>
      {!loaded && !errored ? <div className="absolute inset-0 animate-pulse bg-muted" /> : null}
      {errored ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          {media.type === "video" ? <Film className="size-5" /> : <Layers className="size-5" />}
        </div>
      ) : (
        <Image
          src={media.thumbUrl}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover transition-opacity", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {media.type === "video" ? (
        <span className="absolute top-1.5 right-1.5 rounded-md bg-black/55 p-1 text-white backdrop-blur-sm">
          <Film className="size-3" />
        </span>
      ) : count && count > 1 ? (
        <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Layers className="size-3" />
          {count}
        </span>
      ) : null}
    </div>
  )
}
