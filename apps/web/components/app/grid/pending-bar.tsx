"use client"

import { Check, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Barre de confirmation des permutations : un drag ne « vaut » qu'une fois
// appliqué — Annuler revient à l'ordre initial (audit §1, P0).
export function PendingBar({
  count,
  onApply,
  onUndo,
  onRevert,
}: {
  count: number
  onApply: () => void
  onUndo: () => void
  onRevert: () => void
}) {
  if (count === 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <p className="text-sm font-medium tabular-nums">
        {count} permutation{count > 1 ? "s" : ""} de dates en attente
        <span className="ml-1 font-normal text-muted-foreground">(aperçu)</span>
      </p>
      <span className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onUndo}>
          <Undo2 />
          Annuler la dernière
        </Button>
        <Button variant="outline" size="sm" onClick={onRevert}>
          <X />
          Tout annuler
        </Button>
        <Button size="sm" onClick={onApply}>
          <Check />
          Appliquer
        </Button>
      </span>
    </div>
  )
}
