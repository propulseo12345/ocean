"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Film, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComposerMedia } from "./composer-types"

// Vignette réordonnable de l'éditeur de carrousel (pattern de la grille feed).
// 1re slide = couverture du carrousel.

export function SortableSlide({
  media,
  index,
  active,
  onSelect,
  onRemove,
}: {
  media: ComposerMedia
  index: number
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: media.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative shrink-0 touch-none", isDragging && "z-10 opacity-40")}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Slide ${index + 1}${active ? " (sélectionnée)" : ""}`}
        aria-current={active || undefined}
        className={cn(
          "relative block size-20 overflow-hidden rounded-lg border-2 bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "border-primary" : "border-transparent hover:border-primary/40"
        )}
      >
        <Image
          src={media.thumbUrl}
          alt={media.altText || `Slide ${index + 1}`}
          fill
          sizes="80px"
          className="object-cover"
          draggable={false}
        />
        {media.type === "video" ? (
          <span className="absolute right-1 bottom-1 rounded bg-black/55 p-0.5 text-white backdrop-blur-sm">
            <Film className="size-3" />
          </span>
        ) : null}
        <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm">
          {index + 1}
        </span>
      </button>

      {index === 0 ? (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-px text-[10px] font-medium whitespace-nowrap text-primary-foreground">
          Couverture
        </span>
      ) : null}

      <Button
        variant="secondary"
        size="icon-xs"
        aria-label={`Retirer la slide ${index + 1}`}
        className="absolute -top-1.5 -right-1.5 size-5 rounded-full shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  )
}
