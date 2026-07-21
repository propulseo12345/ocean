"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { LibraryAsset } from "@/lib/domain"
import { useT } from "@/lib/i18n"

// État local d'affichage des assets de médiathèque : édition de l'alt, retrait.
// L'upload réel (TUS) et la persistance alt/suppression (updateAssetAlt /
// deleteAsset, lib/actions/media.ts) sont un handoff Étienne — ici les mutations
// restent locales tant que la source d'assets réelle (TUS) n'existe pas.

export interface UseLibraryAssetsResult {
  assets: LibraryAsset[]
  updateAltText: (id: string, altText: string) => void
  removeAssets: (ids: string[]) => void
}

export function useLibraryAssets(initial: LibraryAsset[]): UseLibraryAssetsResult {
  const t = useT()
  const [assets, setAssets] = useState<LibraryAsset[]>(initial)

  function updateAltText(id: string, altText: string) {
    const trimmed = altText.trim()
    // Texte alternatif monolingue (D1).
    const value = trimmed === "" ? undefined : trimmed
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, altText: value } : a)))
    toast.success(t("library.toast.altSaved"))
  }

  function removeAssets(ids: string[]) {
    const toRemove = new Set(ids)
    setAssets((prev) => prev.filter((a) => !toRemove.has(a.id)))
  }

  return { assets, updateAltText, removeAssets }
}
