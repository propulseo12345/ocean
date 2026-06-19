"use client"

import { useCallback, useMemo, useState } from "react"

export interface UseMultiSelectResult<T extends string = string> {
  /** Ids sélectionnés, dans un ordre stable d'insertion. */
  selectedIds: T[]
  count: number
  isSelected: (id: T) => boolean
  toggle: (id: T) => void
  select: (id: T) => void
  deselect: (id: T) => void
  /** Remplace la sélection par la liste donnée. */
  selectAll: (ids: T[]) => void
  /** Tout sélectionner, ou tout désélectionner si déjà tout sélectionné. */
  toggleAll: (ids: T[]) => void
  clear: () => void
}

/** Sélection multiple générique (studio, grille, calendrier, médiathèque). */
export function useMultiSelect<T extends string = string>(
  initial: T[] = []
): UseMultiSelectResult<T> {
  const [selection, setSelection] = useState<ReadonlySet<T>>(() => new Set(initial))

  const toggle = useCallback((id: T) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const select = useCallback((id: T) => {
    setSelection((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  const deselect = useCallback((id: T) => {
    setSelection((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: T[]) => {
    setSelection(new Set(ids))
  }, [])

  const toggleAll = useCallback((ids: T[]) => {
    setSelection((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set<T>() : new Set(ids)
    })
  }, [])

  const clear = useCallback(() => {
    setSelection(new Set<T>())
  }, [])

  const isSelected = useCallback((id: T) => selection.has(id), [selection])

  const selectedIds = useMemo(() => [...selection], [selection])

  return {
    selectedIds,
    count: selection.size,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    toggleAll,
    clear,
  }
}
