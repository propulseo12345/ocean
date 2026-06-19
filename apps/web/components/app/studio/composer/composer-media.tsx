"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { Crop, ImagePlus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LibraryAsset, Platform } from "@/lib/mocks/types"
import { CAROUSEL_LIMITS, ratioLabel, validateCarousel } from "@/lib/specs"
import {
  applyCrop,
  type ComposerDraft,
  type ComposerMedia,
  mediaFromLibrary,
} from "./composer-types"
import { MediaCropDialog } from "./media-crop-dialog"
import { MediaPickerDialog } from "./media-picker-dialog"
import { MediaSpecSummary } from "./media-spec-summary"
import { SortableSlide } from "./sortable-slide"

// Section « Médias » : sélection médiathèque, éditeur de carrousel (dnd,
// 2–10 slides, 1re = couverture), alt text, recadrage mock, specs par plateforme.

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
}

export function ComposerMediaSection({
  draft,
  platforms,
  libraryAssets,
  onPatch,
}: {
  draft: ComposerDraft
  platforms: Platform[]
  libraryAssets: LibraryAsset[]
  onPatch: (partial: Partial<ComposerDraft>) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [cropId, setCropId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const isCarousel = draft.format === "carousel"
  const media = draft.media
  const active = media.find((m) => m.id === activeId) ?? media[0]
  const cropMedia = media.find((m) => m.id === cropId) ?? null

  function setMedia(next: ComposerMedia[]) {
    onPatch({ media: next })
  }

  function handleAdd(assets: LibraryAsset[]) {
    const added = assets.map((a, i) => mediaFromLibrary(a, media.length + i))
    setMedia(isCarousel ? [...media, ...added] : added.slice(0, 1))
    if (added[0]) setActiveId(added[0].id)
  }

  function handleRemove(id: string) {
    const next = media.filter((m) => m.id !== id)
    setMedia(next)
    if (activeId === id) setActiveId(next[0]?.id ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event
    if (!over || dragged.id === over.id) return
    const from = media.findIndex((m) => m.id === dragged.id)
    const to = media.findIndex((m) => m.id === over.id)
    if (from < 0 || to < 0) return
    setMedia(arrayMove(media, from, to))
  }

  function patchMedia(id: string, partial: Partial<ComposerMedia>) {
    setMedia(media.map((m) => (m.id === id ? { ...m, ...partial } : m)))
  }

  const carouselIssues = isCarousel ? validateCarousel(media.length) : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          Médias
          {isCarousel ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
              {media.length}/{CAROUSEL_LIMITS.max} slides (limite API Meta)
            </span>
          ) : null}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          disabled={isCarousel && media.length >= CAROUSEL_LIMITS.max}
        >
          <ImagePlus />
          Médiathèque
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {media.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ImagePlus className="size-5" />
            Choisir un visuel dans la médiathèque
            <span className="text-xs text-muted-foreground/70">
              Dépôt de fichiers réel au Lot 1 — la preview pioche dans les médias mockés.
            </span>
          </button>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={media.map((m) => m.id)}
                strategy={horizontalListSortingStrategy}
              >
                <ul className="flex gap-3 overflow-x-auto pt-2 pb-1" aria-label="Slides du contenu">
                  {media.map((m, index) => (
                    <SortableSlide
                      key={m.id}
                      media={m}
                      index={index}
                      active={active?.id === m.id}
                      onSelect={() => setActiveId(m.id)}
                      onRemove={() => handleRemove(m.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {isCarousel ? (
              <p className="text-xs text-muted-foreground">
                Glisse les vignettes pour réordonner — la 1<sup>re</sup> slide est la couverture du
                carrousel.
              </p>
            ) : null}

            {active ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {ratioLabel(active.width, active.height)}
                    {active.fileSizeMb !== undefined
                      ? ` · ${active.fileSizeMb.toLocaleString("fr-FR")} Mo`
                      : ""}
                    {active.mimeType ? ` · ${MIME_LABELS[active.mimeType] ?? active.mimeType}` : ""}
                    {active.durationSec !== undefined ? ` · ${active.durationSec} s` : ""}
                    {active.crop ? ` · recadré ${active.crop}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {active.type === "image" ? (
                      <Button variant="outline" size="xs" onClick={() => setCropId(active.id)}>
                        <Crop />
                        Recadrer
                      </Button>
                    ) : null}
                    <Button variant="destructive" size="xs" onClick={() => handleRemove(active.id)}>
                      <Trash2 />
                      Retirer
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="composer-alt" className="text-xs">
                    Texte alternatif (accessibilité)
                  </Label>
                  <Input
                    id="composer-alt"
                    value={active.altText}
                    onChange={(e) => patchMedia(active.id, { altText: e.target.value })}
                    placeholder="Décris le visuel pour les lecteurs d'écran…"
                    className="h-7 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground/70">
                    Envoyé à Instagram et Facebook si la plateforme le supporte.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}

        <MediaSpecSummary
          media={media}
          platforms={platforms}
          draft={draft}
          carouselIssues={carouselIssues}
        />
      </CardContent>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assets={libraryAssets}
        multiple={isCarousel}
        remainingSlots={CAROUSEL_LIMITS.max - (isCarousel ? media.length : 0)}
        onAdd={handleAdd}
      />
      <MediaCropDialog
        media={cropMedia}
        onOpenChange={(open) => {
          if (!open) setCropId(null)
        }}
        onApply={(preset) => {
          if (cropMedia)
            setMedia(media.map((m) => (m.id === cropMedia.id ? applyCrop(m, preset) : m)))
        }}
      />
    </Card>
  )
}
