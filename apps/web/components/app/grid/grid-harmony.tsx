"use client"

import { Palette } from "lucide-react"
import { toast } from "sonner"

// Panneau « Harmonie du feed » — palette déduite du brand kit du client
// (aucune analyse d'image en preview), avec indication de cohérence mockée.

const MOCK_COHERENCE_PERCENT = 82

export function GridHarmony({ palette }: { palette: string[] }) {
  if (palette.length === 0) return null

  function copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success("Couleur copiée", { description: value }))
      .catch(() => toast.error("Impossible de copier la couleur"))
  }

  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Palette className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold">Harmonie du feed</h2>
      </div>

      <div className="flex items-center gap-1.5">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            title={`Copier ${color}`}
            aria-label={`Copier la couleur ${color}`}
            onClick={() => copy(color)}
            className="size-7 rounded-full border transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          />
        ))}
        <span className="size-7 rounded-full border bg-muted" title="Tons neutres clairs" />
        <span className="size-7 rounded-full border bg-foreground/15" title="Tons neutres foncés" />
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Cohérence</span>
          <span className="text-muted-foreground tabular-nums">{MOCK_COHERENCE_PERCENT} %</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${MOCK_COHERENCE_PERCENT}%` }}
          />
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          La plupart des prochaines tuiles restent dans les tons de la marque.
        </p>
      </div>

      <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground/80">
        Aperçu — palette déduite du brand kit, sans analyse d'image. Clique une pastille pour copier
        sa valeur.
      </p>
    </div>
  )
}
