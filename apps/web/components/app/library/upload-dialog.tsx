"use client"

import { CloudUpload, FileImage, Film, Smartphone } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"
import { IG_IMAGE_MAX_MB, REEL_MAX_MB } from "@/lib/specs"
import { cn } from "@/lib/utils"

// Upload simulé : la drop-zone n'envoie rien — un clic (ou un drop) ajoute
// des assets fictifs en état local, avec rappel des specs plateformes.

export function UploadDialog({
  open,
  onOpenChange,
  onSimulate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ajoute les assets fictifs (état local) et affiche le toast. */
  onSimulate: () => void
}) {
  const t = useT()
  const [dragging, setDragging] = useState(false)

  function simulate() {
    setDragging(false)
    onSimulate()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("library.upload.title")}</DialogTitle>
          <DialogDescription>{t("library.upload.description")}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={simulate}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            simulate()
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CloudUpload className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-medium">{t("library.upload.dropTitle")}</span>
          <span className="text-xs text-muted-foreground">{t("library.upload.dropHint")}</span>
        </button>

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
