"use client"

import { Download, Tag, Trash2 } from "lucide-react"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

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
  const t = useT()
  return (
    <SelectionBar
      count={selectedIds.length}
      onClear={onClear}
      itemLabel={t("library.selection.itemLabel")}
    >
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => onDownload(selectedIds)}
      >
        <Download />
        {t("library.selection.download")}
      </Button>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onTag(selectedIds)}>
        <Tag />
        {t("library.selection.tag")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => onDelete(selectedIds)}
      >
        <Trash2 />
        {t("library.selection.delete")}
      </Button>
    </SelectionBar>
  )
}
