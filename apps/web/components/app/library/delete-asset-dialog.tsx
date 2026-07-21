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
import { useT } from "@/lib/i18n"
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
  const t = useT()
  const extra = usages.length - MAX_LISTED

  return (
    <Dialog open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("library.deleteDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("library.deleteDialog.description", {
              name: asset ? assetFileName(asset) : "",
              count: usages.length,
            })}
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
              {t("library.deleteDialog.andMore", { count: extra })}
            </li>
          ) : null}
        </ul>

        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("library.deleteDialog.warning")}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={!asset} onClick={() => asset && onConfirm(asset)}>
            {t("library.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
