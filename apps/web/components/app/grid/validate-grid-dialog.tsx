"use client"

import { Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"

// Demande de validation de la grille ENTIÈRE : le client juge la cohérence
// visuelle du mois, pas des posts isolés (audit §1, P1).
export function ValidateGridDialog({
  open,
  onOpenChange,
  plannedCount,
  reviewerName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plannedCount: number
  reviewerName: string | null
  onConfirm: () => void
}) {
  const t = useT()

  function confirm() {
    onConfirm()
    onOpenChange(false)
    toast.success(t("grid.validate.toastTitle"), {
      description: reviewerName
        ? t("grid.validate.toastWithReviewer", { name: reviewerName })
        : t("grid.validate.toastNoReviewer"),
    })
  }

  const reviewer = reviewerName ? t("grid.validate.reviewerSuffix", { name: reviewerName }) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("grid.validate.title")}</DialogTitle>
          <DialogDescription>
            {t("grid.validate.description", { count: plannedCount, reviewer })}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>{t("grid.validate.bulletFinal")}</li>
          <li>{t("grid.validate.bulletTileByTile")}</li>
          <li>{t("grid.validate.bulletNoEmail")}</li>
        </ul>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
          <Button onClick={confirm}>
            <Send />
            {t("grid.validate.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
