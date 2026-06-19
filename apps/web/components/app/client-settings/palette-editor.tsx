"use client"

import { Copy, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import { PALETTE_SWATCHES } from "./constants"

// Éditeur de palette du brand kit : pastilles oklch ajoutables/supprimables,
// copie d'une valeur (pour Canva). Aucune couleur hex — tout en oklch inline.

export function PaletteEditor({
  palette,
  onChange,
}: {
  palette: string[]
  onChange: (next: string[]) => void
}) {
  const t = useT()

  function copy(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {})
    toast.success(t("clientSettings.palette.copiedToast"), { description: value })
  }

  function remove(index: number) {
    onChange(palette.filter((_, i) => i !== index))
  }

  function add(value: string) {
    if (palette.includes(value)) return
    onChange([...palette, value])
  }

  const available = PALETTE_SWATCHES.filter((s) => !palette.includes(s))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {palette.map((hue, index) => (
        <div key={`${hue}-${index}`} className="group/swatch relative">
          <button
            type="button"
            onClick={() => copy(hue)}
            title={t("clientSettings.palette.copyTitle", { value: hue })}
            aria-label={t("clientSettings.palette.copyAria", { value: hue })}
            className="flex size-10 items-center justify-center rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{ backgroundColor: hue }}
          >
            <Copy className="size-3.5 text-white opacity-0 drop-shadow transition-opacity group-hover/swatch:opacity-100" />
          </button>
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={t("clientSettings.palette.removeAria", { value: hue })}
            className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background group-hover/swatch:flex"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}

      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="icon"
              variant="outline"
              className="size-10"
              aria-label={t("clientSettings.palette.addAria")}
            />
          }
        >
          <Plus />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          {available.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {t("clientSettings.palette.allAdded")}
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {available.map((hue) => (
                <button
                  key={hue}
                  type="button"
                  onClick={() => add(hue)}
                  aria-label={t("clientSettings.palette.addHueAria", { value: hue })}
                  title={hue}
                  className="size-7 rounded-md ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:scale-110"
                  style={{ backgroundColor: hue }}
                />
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Hook utilitaire : indique si la palette diffère de la référence.
export function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
