"use client"

import { Check, CircleAlert, Film, TriangleAlert } from "lucide-react"
import Image from "next/image"
import { useFormat, useLocale, useT } from "@/lib/i18n"
import { pick } from "@/lib/i18n/localized"
import type { LibraryAsset } from "@/lib/mocks/types"
import { ratioLabel, type SpecIssue } from "@/lib/specs"
import { cn } from "@/lib/utils"
import { formatDuration, formatMb, hasSpecErrors, sourceMeta } from "./library-utils"

// Carte d'asset de la médiathèque : vignette, source, usage, specs.
// Clic = fiche détaillée ; en mode sélection, clic = coche.

export interface AssetCardProps {
  asset: LibraryAsset
  issues: SpecIssue[]
  tz: string
  selectMode: boolean
  selected: boolean
  onOpen: (asset: LibraryAsset) => void
  onToggleSelect: (id: string) => void
}

export function AssetCard({
  asset,
  issues,
  tz,
  selectMode,
  selected,
  onOpen,
  onToggleSelect,
}: AssetCardProps) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const used = asset.usedInContentIds.length
  const errored = hasSpecErrors(issues)
  const source = sourceMeta[asset.source]
  const label = asset.altText
    ? pick(asset.altText, locale)
    : t("library.card.fallbackLabel", { id: asset.id })

  return (
    <button
      type="button"
      onClick={() => (selectMode ? onToggleSelect(asset.id) : onOpen(asset))}
      aria-pressed={selectMode ? selected : undefined}
      aria-label={
        selectMode ? t("library.card.selectAria", { label }) : t("library.card.openAria", { label })
      }
      title={issues[0] ? t(issues[0].key, issues[0].params) : undefined}
      className={cn(
        "group block w-full overflow-hidden rounded-xl border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"
      )}
    >
      <span className="relative block aspect-square bg-muted">
        <Image
          src={asset.thumbUrl}
          alt={label}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
          className="object-cover"
        />

        {asset.type === "video" ? (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            <Film className="size-3" aria-hidden />
            {asset.durationSec !== undefined
              ? formatDuration(asset.durationSec)
              : t("library.unit.video")}
          </span>
        ) : null}

        <span
          className={cn(
            "absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm",
            used > 0 ? "bg-black/55 text-white" : "bg-success/90 text-success-foreground"
          )}
        >
          {used > 0 ? t("library.card.usedCount", { count: used }) : t("library.card.unused")}
        </span>

        {issues.length > 0 ? (
          <span
            className={cn(
              "absolute right-1.5 bottom-1.5 rounded-md bg-black/55 p-1 backdrop-blur-sm",
              errored ? "text-destructive" : "text-warning"
            )}
          >
            {errored ? (
              <CircleAlert className="size-3.5" aria-label={t("library.card.offSpec")} />
            ) : (
              <TriangleAlert className="size-3.5" aria-label={t("library.card.specWarning")} />
            )}
          </span>
        ) : null}

        {selectMode ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/70 bg-black/30 backdrop-blur-sm"
            )}
          >
            {selected ? <Check className="size-3.5" /> : null}
          </span>
        ) : null}
      </span>

      <span className="block space-y-1 px-2 py-1.5">
        <span className="flex items-center justify-between gap-1">
          <span
            className={cn(
              "truncate rounded-sm px-1.5 py-px text-[10px] font-medium",
              source.chipClass
            )}
          >
            {t(source.labelKey)}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {f.dayMonth(asset.uploadedAt, tz)}
          </span>
        </span>
        <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
          {asset.width}×{asset.height} · {ratioLabel(asset.width, asset.height)}
          {asset.fileSizeMb !== undefined ? ` · ${formatMb(asset.fileSizeMb, locale, t)}` : ""}
        </span>
      </span>
    </button>
  )
}
