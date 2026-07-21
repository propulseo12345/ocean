"use client"

import { MapPin, MessageSquare } from "lucide-react"
import { useState } from "react"
import { MediaCarousel } from "@/components/portal/media-carousel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import { useFormat, useT } from "@/lib/i18n"
import type { Comment, MediaAsset } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export function AnnotationViewer({
  media,
  comments,
  alt,
}: {
  media: MediaAsset[]
  comments: Comment[]
  alt: string
}) {
  const t = useT()
  const [slideIndex, setSlideIndex] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)

  const pinned = comments.filter((c) => c.annotation)
  const slidePins = pinned.filter((c) => (c.annotation?.slideIndex ?? 0) === slideIndex)

  const focusComment = (c: Comment) => {
    setActiveId(c.id)
    if (c.annotation) setSlideIndex(c.annotation.slideIndex)
  }

  return (
    <div className="space-y-5">
      {media.length > 0 ? (
        <MediaCarousel
          media={media}
          alt={alt}
          index={slideIndex}
          onIndexChange={(next) => {
            setSlideIndex(next)
            setActiveId(null)
          }}
          overlay={slidePins.map((c) => (
            <AnnotationPin
              key={c.id}
              label={pinOrder(pinned, c.id)}
              x={c.annotation!.x}
              y={c.annotation!.y}
              active={activeId === c.id}
              onClick={() => setActiveId(activeId === c.id ? null : c.id)}
            />
          ))}
        />
      ) : null}

      {pinned.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {t("portal.annotation.pinHint")}
        </p>
      ) : null}

      <CommentThread
        comments={comments}
        pinned={pinned}
        activeId={activeId}
        onSelect={focusComment}
      />
    </div>
  )
}

function pinOrder(pinned: Comment[], id: string): number {
  return pinned.findIndex((c) => c.id === id) + 1
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
      aria-label={t("portal.annotation.pinLabel", { label })}
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

function CommentThread({
  comments,
  pinned,
  activeId,
  onSelect,
}: {
  comments: Comment[]
  pinned: Comment[]
  activeId: string | null
  onSelect: (c: Comment) => void
}) {
  const t = useT()
  const f = useFormat()
  if (comments.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <MessageSquare className="size-4" />
        {t("portal.annotation.noThread")}
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {comments.map((c) => {
        const order = c.annotation ? pinned.findIndex((p) => p.id === c.id) + 1 : null
        const isReviewer = c.role === "reviewer"
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                "flex w-full gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                activeId === c.id ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback
                  className={cn(
                    "text-xs",
                    isReviewer ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {initials(c.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {isReviewer ? t("portal.annotation.client") : t("portal.annotation.yourAgency")}
                  </span>
                  {order ? (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/85 text-[10px] font-semibold text-primary-foreground">
                      {order}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {f.relative(c.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground/90">{c.body}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
