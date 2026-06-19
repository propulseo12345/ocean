"use client"

import { Palette } from "lucide-react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"

// Panneau « Harmonie du feed » — palette déduite du brand kit du client
// (aucune analyse d'image en preview), avec indication de cohérence mockée.

const MOCK_COHERENCE_PERCENT = 82

export function GridHarmony({ palette }: { palette: string[] }) {
  const t = useT()
  if (palette.length === 0) return null

  function copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(t("grid.harmony.colorCopied"), { description: value }))
      .catch(() => toast.error(t("grid.harmony.copyError")))
  }

  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Palette className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold">{t("grid.harmony.title")}</h2>
      </div>

      <div className="flex items-center gap-1.5">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            title={t("grid.harmony.copyColor", { color })}
            aria-label={t("grid.harmony.copyColorAria", { color })}
            onClick={() => copy(color)}
            className="size-7 rounded-full border transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          />
        ))}
        <span
          className="size-7 rounded-full border bg-muted"
          title={t("grid.harmony.neutralLight")}
        />
        <span
          className="size-7 rounded-full border bg-foreground/15"
          title={t("grid.harmony.neutralDark")}
        />
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{t("grid.harmony.coherence")}</span>
          <span className="text-muted-foreground tabular-nums">{MOCK_COHERENCE_PERCENT} %</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${MOCK_COHERENCE_PERCENT}%` }}
          />
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t("grid.harmony.coherenceNote")}
        </p>
      </div>

      <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground/80">
        {t("grid.harmony.previewNote")}
      </p>
    </div>
  )
}
