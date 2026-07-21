"use client"

import { TriangleAlert, Upload } from "lucide-react"
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
import type { MediaAsset } from "@/lib/domain"
import { type Translator, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Choix de la couverture d'un Reel : image actuelle ou frame extraite de la
// vidéo (frames simulées par recadrage — preview). La cover alimente la
// vignette de la carte studio et la grille du feed.

interface CoverOption {
  id: string
  label: string
  url: string
  objectClass: string
}

const FRAME_POSITIONS = ["object-top", "object-center", "object-bottom", "object-left"]

function buildOptions(t: Translator, video: MediaAsset, coverUrl?: string): CoverOption[] {
  const duration = video.durationSec ?? 15
  const options: CoverOption[] = []
  if (coverUrl) {
    options.push({
      id: "dedicated",
      label: t("studio.cover.dedicatedCurrent"),
      url: coverUrl,
      objectClass: "object-cover",
    })
  }
  FRAME_POSITIONS.forEach((objectClass, position) => {
    const second = Math.round((duration * position) / FRAME_POSITIONS.length)
    options.push({
      id: `frame-${objectClass}`,
      label: t("studio.cover.frameAt", { sec: second }),
      url: video.thumbUrl,
      objectClass,
    })
  })
  return options
}

export function DetailCoverDialog({
  open,
  onOpenChange,
  video,
  coverUrl,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  video: MediaAsset
  coverUrl?: string
  onSelect: (label: string) => void
}) {
  const t = useT()
  const options = buildOptions(t, video, coverUrl)
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "")
  const selected = options.find((o) => o.id === selectedId) ?? options[0]

  function confirm() {
    if (!selected) return
    onSelect(selected.label)
    toast.success(t("studio.cover.updated"), {
      description: t("studio.cover.updatedDesc"),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("studio.cover.title")}</DialogTitle>
          <DialogDescription>{t("studio.cover.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedId(option.id)}
              aria-pressed={option.id === selectedId}
              className={cn(
                "group flex flex-col gap-1 rounded-lg p-1 text-left transition-colors",
                option.id === selectedId ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "relative block aspect-[4/5] w-full overflow-hidden rounded-md border-2",
                  option.id === selectedId ? "border-primary" : "border-transparent"
                )}
              >
                <Image
                  src={option.url}
                  alt={option.label}
                  fill
                  sizes="96px"
                  className={cn("object-cover", option.objectClass)}
                />
              </span>
              <span className="truncate text-[10px] text-muted-foreground">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <p>{t("studio.cover.tiktokWarning")}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            toast.info(t("studio.cover.importSimulated"), {
              description: t("studio.cover.importSimulatedDesc"),
            })
          }
        >
          <Upload />
          {t("studio.cover.importDedicated")}
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm}>{t("studio.cover.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
