"use client"

import { Download, Tag, Trash2 } from "lucide-react"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"

// Actions par lot sur les médias sélectionnés (batch mensuel).

export function LibrarySelectionBar({
  selectedIds,
  onClear,
  onDownload,
  onTag,
  onDelete,
}: {
  selectedIds: string[]
  onClear: () => void
  onDownload: (ids: string[]) => void
  onTag: (ids: string[]) => void
  onDelete: (ids: string[]) => void
}) {
  return (
    <SelectionBar count={selectedIds.length} onClear={onClear} itemLabel="sélectionné">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => onDownload(selectedIds)}
      >
        <Download />
        Télécharger (aperçu)
      </Button>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onTag(selectedIds)}>
        <Tag />
        Taguer
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => onDelete(selectedIds)}
      >
        <Trash2 />
        Supprimer
      </Button>
    </SelectionBar>
  )
}
