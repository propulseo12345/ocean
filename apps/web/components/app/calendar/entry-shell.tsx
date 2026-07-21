"use client"

import { useDraggable } from "@dnd-kit/core"
import { Check } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ContentItem } from "@/lib/domain"
import { useLabels, useLocale, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { isMovable } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"
import { ContentQuickView } from "./content-quick-view"
import { entryAriaLabel } from "./entry-markers"

// Enveloppe interactive d'une carte de contenu :
// — mode normal : draggable (si statut déplaçable) + aperçu rapide au clic ;
// — mode sélection : case à cocher, le clic sélectionne.

function SelectionCheck({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      )}
    >
      {selected ? <Check className="size-3" /> : null}
    </span>
  )
}

export function EntryShell({
  item,
  ctx,
  className,
  style,
  children,
}: {
  item: ContentItem
  ctx: DayContext
  /** Style de la carte (fond, bordure, padding) fourni par l'appelant. */
  className?: string
  /** Variables CSS dynamiques (liseré pilier) — jamais de couleur en dur. */
  style?: CSSProperties
  children: ReactNode
}) {
  const t = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  const draggable = isMovable(item) && !ctx.selectionMode
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggable,
  })

  const ariaLabel = entryAriaLabel(item, lbl, locale, t)
  const base = "relative flex w-full items-center gap-1.5 text-left outline-none"

  if (ctx.selectionMode) {
    const selected = ctx.isSelected(item.id)
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={t("calendar.entryShell.select", { label: ariaLabel })}
        onClick={() => ctx.onToggleSelect(item.id)}
        style={style}
        className={cn(base, className, selected && "ring-2 ring-primary/60")}
      >
        <SelectionCheck selected={selected} />
        <span className="min-w-0 flex-1">{children}</span>
      </button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            ref={setNodeRef}
            type="button"
            {...listeners}
            {...attributes}
            aria-label={ariaLabel}
            style={style}
            className={cn(
              base,
              "focus-visible:ring-2 focus-visible:ring-ring",
              // touch-manipulation (pas touch-none) : le scroll mobile reste
              // possible, l'appui long déclenche le drag (TouchSensor).
              draggable && "cursor-grab touch-manipulation active:cursor-grabbing",
              isDragging && "opacity-40",
              className
            )}
          />
        }
      >
        <span className="min-w-0 flex-1">{children}</span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-3">
        <ContentQuickView item={item} ctx={ctx} />
      </PopoverContent>
    </Popover>
  )
}
