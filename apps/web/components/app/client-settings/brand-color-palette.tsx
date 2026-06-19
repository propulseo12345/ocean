"use client"

import { Check } from "lucide-react"
import { BRAND_HUES } from "./constants"

// Sélecteur de teinte de marque : pastilles oklch prédéfinies cliquables
// (jamais de color picker hex). La teinte est appliquée en style inline.

export function BrandColorPalette({
  value,
  onChange,
}: {
  value: string
  onChange: (hue: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur de marque">
      {BRAND_HUES.map((hue) => {
        const selected = hue.value === value
        return (
          <button
            key={hue.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={hue.name}
            title={hue.name}
            onClick={() => onChange(hue.value)}
            className="relative flex size-8 items-center justify-center rounded-full ring-1 ring-foreground/10 transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:scale-110"
            style={{ backgroundColor: hue.value }}
          >
            {selected ? (
              <Check className="size-4 text-white drop-shadow" strokeWidth={3} aria-hidden />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
