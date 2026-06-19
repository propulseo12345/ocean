"use client"

import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LibraryAsset } from "@/lib/mocks/types"
import type { UsageRef } from "./library-types"
import { assetFileName } from "./library-utils"

// Garde de suppression : un asset utilisé dans des contenus ne se supprime
// qu'après confirmation explicite, avec la liste des contenus concernés.

const MAX_LISTED = 4

export function DeleteAssetDialog({
  asset,
  usages,
  onClose,
  onConfirm,
}: {
  asset: LibraryAsset | null
  usages: UsageRef[]
  onClose: () => void
  onConfirm: (asset: LibraryAsset) => void
}) {
  const extra = usages.length - MAX_LISTED

  return (
    <Dialog open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer ce média ?</DialogTitle>
          <DialogDescription>
            {asset ? assetFileName(asset) : ""} est utilisé dans {usages.length} contenu
            {usages.length > 1 ? "s" : ""} :
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {usages.slice(0, MAX_LISTED).map((u) => (
            <li key={u.id} className="truncate">
              {u.title}
            </li>
          ))}
          {extra > 0 ? (
            <li className="text-muted-foreground">
              et {extra} autre{extra > 1 ? "s" : ""}…
            </li>
          ) : null}
        </ul>

        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          En réel, ces contenus perdraient ce visuel et repasseraient en brouillon. En preview, la
          suppression est purement visuelle.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={!asset} onClick={() => asset && onConfirm(asset)}>
            Supprimer quand même (aperçu)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
