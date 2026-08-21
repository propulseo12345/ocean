"use client"

import { FileImage, Film, Smartphone } from "lucide-react"

import { MediaDropzone } from "@/components/app/media/media-dropzone"
import { UploadQueue } from "@/components/app/media/upload-queue"
import type { UploadItem } from "@/components/app/media/use-media-upload"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"
import { IG_IMAGE_MAX_MB, REEL_MAX_MB } from "@/lib/specs"

// P5-7 — ce dialogue ne simule plus rien.
//
// AVANT : un `<button>` dont `onDrop` appelait `simulate()` en JETANT
// `e.dataTransfer`, et un `onSimulate` qui affichait un toast « l'upload arrive
// bientôt ». Zéro `<input type="file">` dans le dépôt. La zone avait l'air de
// marcher — c'est la pire forme de code non fait.

export function UploadDialog({
  open,
  onOpenChange,
  onFiles,
  items,
  onCancel,
  onDismiss,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[]) => void
  items: UploadItem[]
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("library.upload.title")}</DialogTitle>
          <DialogDescription>{t("library.upload.description")}</DialogDescription>
        </DialogHeader>

        <MediaDropzone onFiles={onFiles} />

        <UploadQueue items={items} onCancel={onCancel} onDismiss={onDismiss} />

        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-1.5">
            <FileImage className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("library.upload.specImage", { max: IG_IMAGE_MAX_MB })}
          </li>
          <li className="flex items-start gap-1.5">
            <Smartphone className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("library.upload.specHeic")}
          </li>
          <li className="flex items-start gap-1.5">
            <Film className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("library.upload.specReel", { max: REEL_MAX_MB })}
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
