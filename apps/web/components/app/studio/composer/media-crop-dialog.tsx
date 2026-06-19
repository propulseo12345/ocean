"use client"

import { Crop, Info } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ratioLabel } from "@/lib/specs"
import { cn } from "@/lib/utils"
import type { ComposerMedia, CropPreset } from "./composer-types"

// Recadrage guidé (mock) : presets 1:1 / 4:5 / 9:16 prévisualisés en CSS
// (object-fit + aspect-ratio). Aucun traitement d'image réel en preview.

const PRESETS: Array<{ value: CropPreset; label: string; hint: string }> = [
  { value: "1:1", label: "1:1", hint: "Carré (feed)" },
  { value: "4:5", label: "4:5", hint: "Portrait (recommandé IG)" },
  { value: "9:16", label: "9:16", hint: "Vertical (Reel, story)" },
]

const ASPECT_CLASS: Record<CropPreset, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
}

export function MediaCropDialog({
  media,
  onOpenChange,
  onApply,
}: {
  /** Média à recadrer — null = dialog fermé. */
  media: ComposerMedia | null
  onOpenChange: (open: boolean) => void
  onApply: (preset: CropPreset) => void
}) {
  const [preset, setPreset] = useState<CropPreset>("4:5")

  function apply() {
    onApply(preset)
    onOpenChange(false)
    toast.success(`Recadrage ${preset} appliqué (aperçu)`, {
      description: "Aucun traitement d'image réel pendant la preview.",
    })
  }

  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recadrer le visuel</DialogTitle>
          <DialogDescription>
            {media
              ? `Ratio actuel : ${ratioLabel(media.width, media.height)}${
                  media.fileSizeMb !== undefined
                    ? ` · ${media.fileSizeMb.toLocaleString("fr-FR")} Mo`
                    : ""
                }`
              : null}
          </DialogDescription>
        </DialogHeader>

        {media ? (
          <div className="space-y-3">
            <div className="flex justify-center rounded-lg border bg-muted/40 p-3">
              <div
                className={cn(
                  "relative w-full max-w-56 overflow-hidden rounded-md bg-muted ring-2 ring-primary/60",
                  ASPECT_CLASS[preset]
                )}
              >
                <Image
                  src={media.fullUrl}
                  alt={media.altText || "Visuel à recadrer"}
                  fill
                  sizes="224px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <ToggleGroup
                value={[preset]}
                onValueChange={(v) => {
                  const next = v[0] as CropPreset | undefined
                  if (next) setPreset(next)
                }}
                variant="outline"
                size="sm"
              >
                {PRESETS.map((p) => (
                  <ToggleGroupItem key={p.value} value={p.value} title={p.hint} className="gap-1.5">
                    <Crop className="size-3.5" />
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {PRESETS.find((p) => p.value === preset)?.hint}
            </p>

            <p className="flex items-start gap-1.5 rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              Export en JPEG ≤ 8 Mo — conversion et compression automatiques avant publication
              (specs Instagram).
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={apply}>Appliquer le recadrage</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
