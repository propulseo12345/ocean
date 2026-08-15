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
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { MediaDropzone } from "@/components/app/media/media-dropzone"
import { UploadQueue } from "@/components/app/media/upload-queue"
import { useMediaUpload } from "@/components/app/media/use-media-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LibraryAsset, Platform } from "@/lib/domain"
import { INTL_LOCALE, useLocale, useT } from "@/lib/i18n"
import { CAROUSEL_LIMITS, ratioLabel, validateCarousel } from "@/lib/specs"
import {
  applyCrop,
  type ComposerDraft,
  type ComposerMedia,
  type CropPreset,
  mediaFromLibrary,
  mediaFromUpload,
} from "./composer-types"
import { MediaCropDialog } from "./media-crop-dialog"
import { MediaPickerDialog } from "./media-picker-dialog"
import { MediaSpecSummary } from "./media-spec-summary"
import { SortableSlide } from "./sortable-slide"

// Section « Médias » : sélection médiathèque, dépôt direct de fichiers, éditeur
// de carrousel (dnd, 2–10 slides, 1re = couverture), alt text, recadrage RÉEL
// (P5-9 : l'image est relue, rognée, réencodée et re-téléversée), specs par
// plateforme.

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
}

/** Média que le recadrage doit remplacer (transporté via `meta` de la file). */
interface CropMeta {
  remplace: string
  preset: CropPreset
}

export function ComposerMediaSection({
  draft,
  platforms,
  libraryAssets,
  orgId,
  clientId,
  onPatch,
}: {
  draft: ComposerDraft
  platforms: Platform[]
  libraryAssets: LibraryAsset[]
  orgId: string
  clientId: string
  onPatch: (partial: Partial<ComposerDraft>) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale])
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

  // Le brouillon vit dans l'état du parent : la callback doit lire `draft.media`
  // au moment où elle s'exécute, jamais la valeur capturée à la création du hook
  // — un téléversement dure plusieurs secondes, le brouillon a bougé entre-temps.
  const onUploaded = useCallback(
    (
      asset: Parameters<NonNullable<Parameters<typeof useMediaUpload>[0]["onUploaded"]>>[0],
      meta?: unknown
    ) => {
      const crop = (meta as CropMeta | undefined)?.preset
      const remplace = (meta as CropMeta | undefined)?.remplace
      onPatch({
        media: (() => {
          const courant = draft.media
          if (remplace) {
            // Recadrage : on SUBSTITUE, on n'ajoute pas. La version recadrée est
            // un nouvel asset (nouveau fichier, nouvelles dimensions réelles) ;
            // l'original reste dans la médiathèque, intact.
            return courant.map((m) =>
              m.id === remplace ? mediaFromUpload(asset, courant.indexOf(m), crop) : m
            )
          }
          const ajouté = mediaFromUpload(asset, courant.length)
          return isCarousel ? [...courant, ajouté] : [ajouté]
        })(),
      })
    },
    [draft.media, isCarousel, onPatch]
  )

  const upload = useMediaUpload({ orgId, clientId, onUploaded })

  /**
   * P5-9 — le recadrage TOUCHE enfin les pixels.
   *
   * Depuis P5-4, `applyCrop` ne posait qu'une intention : c'était honnête, mais
   * rien ne la traitait, donc un contenu « recadré en 4:5 » partait toujours au
   * ratio d'origine. Ici, l'original est relu depuis son URL signée, décodé,
   * rogné et réencodé, puis téléversé comme un NOUVEL asset. Le média du
   * brouillon pointe sur lui ; l'original n'est ni écrasé ni supprimé.
   *
   * Le repli sur `applyCrop` n'est pas décoratif : si l'original n'est pas
   * relisible (URL signée expirée, réseau coupé), on garde l'intention plutôt
   * que de faire disparaître le geste de l'utilisateur — mais rien n'affirme
   * alors que l'image est conforme.
   */
  async function handleCrop(cible: ComposerMedia, preset: CropPreset) {
    try {
      const res = await fetch(cible.fullUrl)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const fichier = new File([blob], `recadre-${preset.replace(":", "x")}.jpg`, {
        type: blob.type || "image/jpeg",
      })
      upload.enqueue([fichier], { crop: preset, meta: { remplace: cible.id, preset } })
    } catch {
      toast.error(t("composer.media.cropFailed"))
      setMedia(media.map((m) => (m.id === cible.id ? applyCrop(m, preset) : m)))
    }
  }

  function handleAdd(assets: LibraryAsset[]) {
    const added = assets.map((a, i) => mediaFromLibrary(a, media.length + i, locale))
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
          {t("composer.media.title")}
          {isCarousel ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
              {t("composer.media.slidesCount", {
                count: media.length,
                max: CAROUSEL_LIMITS.max,
              })}
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
          {t("composer.media.libraryButton")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {media.length === 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ImagePlus className="size-5" />
              {t("composer.media.emptyChoose")}
              <span className="text-xs text-muted-foreground/70">
                {t("composer.media.emptyHint")}
              </span>
            </button>
            {/* Déposer un fichier ICI, sans passer par la médiathèque : c'est
                le geste naturel quand on compose depuis un téléphone. */}
            <MediaDropzone compact multiple={isCarousel} onFiles={(f) => upload.enqueue(f)} />
          </div>
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
                <ul
                  className="flex gap-3 overflow-x-auto pt-2 pb-1"
                  aria-label={t("composer.media.slidesAria")}
                >
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
              <p className="text-xs text-muted-foreground">{t("composer.media.carouselReorder")}</p>
            ) : null}

            {active ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {ratioLabel(active.width, active.height)}
                    {active.fileSizeMb !== undefined
                      ? ` · ${t("composer.media.sizeMb", { size: nf.format(active.fileSizeMb) })}`
                      : ""}
                    {active.mimeType ? ` · ${MIME_LABELS[active.mimeType] ?? active.mimeType}` : ""}
                    {active.durationSec !== undefined
                      ? ` · ${t("composer.media.duration", { count: active.durationSec })}`
                      : ""}
                    {active.crop
                      ? ` · ${t("composer.media.cropped", { preset: active.crop })}`
                      : ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {active.type === "image" ? (
                      <Button variant="outline" size="xs" onClick={() => setCropId(active.id)}>
                        <Crop />
                        {t("composer.media.crop")}
                      </Button>
                    ) : null}
                    <Button variant="destructive" size="xs" onClick={() => handleRemove(active.id)}>
                      <Trash2 />
                      {t("composer.media.remove")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="composer-alt" className="text-xs">
                    {t("composer.media.altLabel")}
                  </Label>
                  <Input
                    id="composer-alt"
                    value={active.altText}
                    onChange={(e) => patchMedia(active.id, { altText: e.target.value })}
                    placeholder={t("composer.media.altPlaceholder")}
                    className="h-7 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground/70">
                    {t("composer.media.altHint")}
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}

        {media.length > 0 ? (
          <MediaDropzone
            compact
            multiple={isCarousel}
            disabled={isCarousel && media.length >= CAROUSEL_LIMITS.max}
            onFiles={(f) => upload.enqueue(f)}
          />
        ) : null}

        <UploadQueue items={upload.items} onCancel={upload.cancel} onDismiss={upload.dismiss} />

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
          if (cropMedia) void handleCrop(cropMedia, preset)
        }}
      />
    </Card>
  )
}
