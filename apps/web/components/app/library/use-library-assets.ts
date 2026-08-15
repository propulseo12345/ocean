"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteAsset, updateAssetAlt } from "@/lib/actions/media"
import type { LibraryAsset } from "@/lib/domain"
import { useT } from "@/lib/i18n"

// Ticket P5-8 — la médiathèque ne persistait RIEN.
//
// `updateAltText` et `removeAssets` ne touchaient qu'un `useState`, et
// `updateAltText` affichait quand même « Texte alternatif enregistré ». Rien ne
// partait en base : au premier rechargement, l'alt était revenu et le média
// supprimé était de retour. Les deux Server Actions qui font le travail
// (`updateAssetAlt`, `deleteAsset`) étaient écrites, validées Zod, et n'avaient
// aucun appelant.
//
// L'alt-text n'est pas cosmétique : Instagram l'expose aux lecteurs d'écran, et
// c'est le seul champ d'accessibilité que le produit propose.
//
// `useOptimistic` : l'écran réagit au clic, mais l'état affiché redevient celui
// du serveur au `router.refresh()`. Si l'écriture échoue, l'affichage revient
// tout seul à la vérité — c'est exactement ce qui manquait.

export interface UseLibraryAssetsResult {
  assets: LibraryAsset[]
  updateAltText: (id: string, altText: string) => void
  removeAssets: (ids: string[]) => void
  pending: boolean
}

type Optimistic =
  | { kind: "alt"; id: string; altText: string | undefined }
  | { kind: "remove"; ids: Set<string> }

export function useLibraryAssets(
  initial: LibraryAsset[],
  clientId: string
): UseLibraryAssetsResult {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [serverAssets] = useState<LibraryAsset[]>(initial)

  const [assets, applyOptimistic] = useOptimistic(
    serverAssets,
    (current: LibraryAsset[], action: Optimistic) => {
      if (action.kind === "alt") {
        return current.map((a) => (a.id === action.id ? { ...a, altText: action.altText } : a))
      }
      return current.filter((a) => !action.ids.has(a.id))
    }
  )

  function updateAltText(id: string, altText: string) {
    const trimmed = altText.trim()
    // Texte alternatif monolingue (D1).
    const value = trimmed === "" ? undefined : trimmed

    startTransition(async () => {
      applyOptimistic({ kind: "alt", id, altText: value })
      const res = await updateAssetAlt({ clientId, assetId: id, altText: trimmed })
      if (!res.ok) {
        toast.error(t("library.toast.altError"))
        router.refresh()
        return
      }
      toast.success(t("library.toast.altSaved"))
      router.refresh()
    })
  }

  function removeAssets(ids: string[]) {
    if (ids.length === 0) return

    startTransition(async () => {
      applyOptimistic({ kind: "remove", ids: new Set(ids) })

      // Une suppression par asset : `deleteAsset` refuse un média encore
      // rattaché à un contenu ou servant de couverture (FK restrict). On veut
      // donc savoir LESQUELS ont été refusés, pas un échec global muet.
      const résultats = await Promise.all(
        ids.map(async (assetId) => ({
          assetId,
          res: await deleteAsset({ clientId, assetId }),
        }))
      )

      const refusés = résultats.filter((r) => !r.res.ok)
      const enUsage = refusés.filter(
        (r) => r.res.ok === false && (r.res.error === "in_use" || r.res.error === "in_use_cover")
      )

      if (enUsage.length > 0) {
        toast.error(t("library.toast.deleteInUse", { count: enUsage.length }))
      } else if (refusés.length > 0) {
        toast.error(t("library.toast.deleteError"))
      } else {
        toast.success(t("library.toast.deleted", { count: ids.length }))
      }

      // Rejoue la vérité du serveur : ce qui a été refusé réapparaît.
      router.refresh()
    })
  }

  return { assets, updateAltText, removeAssets, pending }
}
