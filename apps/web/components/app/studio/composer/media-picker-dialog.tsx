"use client"

import { Check, Film } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { INTL_LOCALE, pick, useLocale, useT } from "@/lib/i18n"
import type { LibraryAsset } from "@/lib/mocks/types"
import { ratioLabel } from "@/lib/specs"
import { cn } from "@/lib/utils"

// Sélecteur de médias depuis la médiathèque mockée du client.
// Badge « Utilisé / Inédit », multi-sélection en mode carrousel.

export function MediaPickerDialog({
  open,
  onOpenChange,
  assets,
  multiple,
  remainingSlots,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assets: LibraryAsset[]
  multiple: boolean
  /** Slides restantes en mode carrousel (limite API 10). */
  remainingSlots: number
  onAdd: (selected: LibraryAsset[]) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const max = multiple ? remainingSlots : 1

  function toggle(asset: LibraryAsset) {
    setSelectedIds((ids) => {
      if (ids.includes(asset.id)) return ids.filter((id) => id !== asset.id)
      if (!multiple) return [asset.id]
      if (ids.length >= max) return ids
      return [...ids, asset.id]
    })
  }

  function confirm() {
    const selected = selectedIds
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is LibraryAsset => a !== undefined)
    onAdd(selected)
    setSelectedIds([])
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedIds([])
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("composer.picker.title")}</DialogTitle>
          <DialogDescription>
            {multiple
              ? t("composer.picker.descMultiple", { max })
              : t("composer.picker.descSingle")}
          </DialogDescription>
        </DialogHeader>

        <ul className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {assets.map((asset) => {
            const selected = selectedIds.includes(asset.id)
            const used = asset.usedInContentIds.length > 0
            const disabled = !selected && multiple && selectedIds.length >= max
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => toggle(asset)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-lg border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary" : "border-transparent hover:border-primary/40",
                    disabled && "opacity-40"
                  )}
                >
                  <span className="relative block aspect-square bg-muted">
                    <Image
                      src={asset.thumbUrl}
                      alt={
                        asset.altText ? pick(asset.altText, locale) : t("composer.picker.assetAlt")
                      }
                      fill
                      sizes="(max-width: 640px) 33vw, 160px"
                      className="object-cover"
                    />
                    {asset.type === "video" ? (
                      <span className="absolute top-1.5 right-1.5 rounded-md bg-black/55 p-1 text-white backdrop-blur-sm">
                        <Film className="size-3" />
                      </span>
                    ) : null}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "absolute top-1.5 left-1.5 border-none px-1.5 py-0 text-[10px]",
                        used
                          ? "bg-black/55 text-white backdrop-blur-sm"
                          : "bg-success/90 text-white"
                      )}
                    >
                      {used ? t("composer.picker.used") : t("composer.picker.unused")}
                    </Badge>
                    {selected ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate px-1 py-1 text-[11px] text-muted-foreground tabular-nums">
                    {ratioLabel(asset.width, asset.height)}
                    {asset.fileSizeMb !== undefined
                      ? ` · ${t("composer.media.sizeMb", { size: nf.format(asset.fileSizeMb) })}`
                      : ""}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm} disabled={selectedIds.length === 0}>
            {selectedIds.length > 0
              ? t("composer.picker.addCount", { count: selectedIds.length })
              : t("composer.picker.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
