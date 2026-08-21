"use client"

import { MapPin } from "lucide-react"
import { useState } from "react"
import { AnnotationComposer, type DraftAnnotation } from "@/components/portal/annotation-composer"
import { AnnotationPin, CommentThread, DraftPin } from "@/components/portal/annotation-thread"
import { MediaCarousel } from "@/components/portal/media-carousel"
import type { Comment, MediaAsset } from "@/lib/domain"
import { useT } from "@/lib/i18n"

// Feature « Pastel » — relecture annotée côté client.
//
// Le reviewer lit les visuels, pose un repère à un endroit précis (fraction
// 0..1 du cadre, ancrée sur la liaison content_media pour survivre à un
// réordonnancement) et laisse sa remarque. Les repères déjà posés restent
// cliquables pour naviguer dans le fil.
//
// Ce composant ne porte QUE l'état d'interaction : l'autorisation d'écrire est
// tranchée par la RLS (un reviewer n'insère que visibility='client' sous sa
// propre identité, sur un contenu qui lui est visible).

export function AnnotationViewer({
  media,
  comments,
  alt,
  contentId,
}: {
  media: MediaAsset[]
  comments: Comment[]
  alt: string
  contentId: string
}) {
  const t = useT()
  const [slideIndex, setSlideIndex] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<DraftAnnotation | null>(null)

  const pinned = comments.filter((c) => c.annotation)
  const current = media[slideIndex]
  // Un contenu texte seul (ou un média sans liaison résolue) ne s'épingle pas.
  const anchorId = current?.contentMediaId
  // Appariement par ANCRE (content_media), pas par index de tableau : un média
  // masqué décalerait les index et ferait glisser les repères d'un visuel.
  const slidePins = pinned.filter((c) =>
    anchorId
      ? c.annotation?.contentMediaId === anchorId
      : (c.annotation?.slideIndex ?? 0) === slideIndex
  )

  const focusComment = (c: Comment) => {
    setActiveId(c.id)
    const anchor = c.annotation
    if (!anchor) return
    const index = media.findIndex((m) => m.contentMediaId === anchor.contentMediaId)
    setSlideIndex(index >= 0 ? index : anchor.slideIndex)
  }

  const pickPoint = (point: { x: number; y: number }) => {
    if (!anchorId) return
    setDraft({ contentMediaId: anchorId, slideIndex, x: point.x, y: point.y })
    // Un seul point à la fois : on sort du mode placement pour laisser la main
    // au texte. Reposer un repère = réactiver le mode.
    setPicking(false)
  }

  return (
    <div className="space-y-5">
      {media.length > 0 ? (
        <MediaCarousel
          media={media}
          alt={alt}
          index={slideIndex}
          picking={picking}
          onPickPoint={pickPoint}
          onIndexChange={(next) => {
            setSlideIndex(next)
            setActiveId(null)
          }}
          overlay={
            <>
              {slidePins.map((c) => (
                <AnnotationPin
                  key={c.id}
                  label={pinOrder(pinned, c.id)}
                  x={c.annotation!.x}
                  y={c.annotation!.y}
                  active={activeId === c.id}
                  onClick={() => setActiveId(activeId === c.id ? null : c.id)}
                />
              ))}
              {draft && draft.slideIndex === slideIndex ? (
                <DraftPin x={draft.x} y={draft.y} />
              ) : null}
            </>
          }
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

      <AnnotationComposer
        contentId={contentId}
        pin={draft}
        picking={picking}
        canPin={Boolean(anchorId)}
        onTogglePicking={() => setPicking((p) => !p)}
        onClearPin={() => setDraft(null)}
        onPosted={() => {
          setDraft(null)
          setPicking(false)
        }}
      />
    </div>
  )
}

function pinOrder(pinned: Comment[], id: string): number {
  return pinned.findIndex((c) => c.id === id) + 1
}
