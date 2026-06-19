"use client"

import { X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Barre flottante d'actions par lot — rendue uniquement si count > 0.
// `children` : slot des boutons d'action (fournis par chaque page).

export function SelectionBar({
  count,
  onClear,
  children,
  itemLabel,
  className,
}: {
  count: number
  onClear: () => void
  children?: ReactNode
  /**
   * Libellé déjà localisé et accordé de l'élément (« sélectionnés »).
   * Par défaut : libellé générique « sélectionné(s) » / « selected ».
   */
  itemLabel?: string
  className?: string
}) {
  const t = useT()
  if (count === 0) return null

  const label = itemLabel ?? t("portal.shared.itemSelected", { count })

  return (
    <div
      role="toolbar"
      aria-label={t("portal.shared.selectionActions")}
      className={cn(
        "fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border bg-card/95 py-1.5 pr-1.5 pl-4 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      <span className="text-sm font-medium whitespace-nowrap tabular-nums">
        {t("portal.shared.selectionCount", { count, item: label })}
      </span>
      {children ? <div className="flex items-center gap-1">{children}</div> : null}
      <Button variant="ghost" size="sm" onClick={onClear} className="rounded-full">
        <X />
        {t("portal.shared.clearSelection")}
      </Button>
    </div>
  )
}
