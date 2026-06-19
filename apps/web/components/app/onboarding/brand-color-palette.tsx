"use client"

import { Check } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { BRAND_COLORS } from "./wizard-types"

// Palette de teintes de marque prédéfinies (valeurs oklch issues des données).
// Aucune saisie hex : on clique une teinte, appliquée via style inline comme
// le fait déjà client-avatar.tsx pour brandColor.

export function BrandColorPalette({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (color: string) => void
  label?: string
}) {
  const t = useT()
  const legend = label ?? t("onboarding.palette.brandColorLabel")
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {BRAND_COLORS.map((color) => {
          const active = color.value === value
          const colorLabel = t(color.labelKey)
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(color.value)}
              aria-pressed={active}
              aria-label={colorLabel}
              title={colorLabel}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all outline-none focus-visible:ring-ring",
                active && "ring-foreground/60"
              )}
              style={{ backgroundColor: color.value }}
            >
              {active ? <Check className="size-4 text-white" /> : null}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// Variante « multi » : composer une palette de 3 à 5 teintes (brand kit).
export function BrandPaletteEditor({
  palette,
  onChange,
}: {
  palette: string[]
  onChange: (palette: string[]) => void
}) {
  const t = useT()
  const atMax = palette.length >= 5

  function toggle(color: string) {
    if (palette.includes(color)) {
      if (palette.length <= 1) return
      onChange(palette.filter((c) => c !== color))
      return
    }
    if (atMax) return
    onChange([...palette, color])
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("onboarding.palette.paletteLabel")}</legend>
      <p className="text-xs text-muted-foreground">{t("onboarding.palette.paletteHint")}</p>
      <div className="flex flex-wrap gap-2">
        {BRAND_COLORS.map((color) => {
          const active = palette.includes(color.value)
          const disabled = !active && atMax
          const colorLabel = t(color.labelKey)
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => toggle(color.value)}
              aria-pressed={active}
              aria-label={colorLabel}
              title={colorLabel}
              disabled={disabled}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
                active && "ring-foreground/60"
              )}
              style={{ backgroundColor: color.value }}
            >
              {active ? <Check className="size-4 text-white" /> : null}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("onboarding.palette.selectedCount", { count: palette.length })}
        {atMax ? ` · ${t("onboarding.palette.maxReached")}` : ""}
      </p>
    </fieldset>
  )
}
