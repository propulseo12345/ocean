"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { nowIso } from "@/lib/clock"
import { useT } from "@/lib/i18n"
import { IMAGES } from "@/lib/mocks/images"
import type { Client, LibraryAsset } from "@/lib/mocks/types"

// État local des assets (preview) : ajout simulé, alt text, suppression.
// Aucune persistance — tout est perdu à la navigation, comme le reste du mock.

const NEW_ASSET_SHAPES = [
  { width: 1080, height: 1350, fileSizeMb: 2.2 },
  { width: 1080, height: 1080, fileSizeMb: 1.7 },
] as const

export interface UseLibraryAssetsResult {
  assets: LibraryAsset[]
  addMockAssets: () => void
  updateAltText: (id: string, altText: string) => void
  removeAssets: (ids: string[]) => void
}

export function useLibraryAssets(client: Client, initial: LibraryAsset[]): UseLibraryAssetsResult {
  const t = useT()
  const [assets, setAssets] = useState<LibraryAsset[]>(initial)
  const counter = useRef(0)

  function addMockAssets() {
    const pool = IMAGES[client.theme]
    const created: LibraryAsset[] = NEW_ASSET_SHAPES.map((shape) => {
      counter.current += 1
      const url = pool[counter.current % pool.length]
      return {
        id: `la_new_${counter.current}`,
        clientId: client.id,
        type: "image",
        thumbUrl: url,
        fullUrl: url,
        width: shape.width,
        height: shape.height,
        uploadedAt: nowIso(),
        source: "upload",
        usedInContentIds: [],
        fileSizeMb: shape.fileSizeMb,
        mimeType: "image/jpeg",
      }
    })
    setAssets((prev) => [...created, ...prev])
    toast.success(t("library.toast.added", { count: created.length }), {
      description: t("library.toast.addedDesc"),
    })
  }

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

  return { assets, addMockAssets, updateAltText, removeAssets }
}
