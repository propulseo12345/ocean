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
  function confirm() {
    onConfirm()
    onOpenChange(false)
    toast.success("Grille envoyée en validation (aperçu)", {
      description: reviewerName
        ? `${reviewerName} recevrait un lien vers l'aperçu en lecture seule dans le portail.`
        : "Le client recevrait un lien vers l'aperçu en lecture seule dans le portail.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander la validation de la grille</DialogTitle>
          <DialogDescription>
            {plannedCount} publication{plannedCount > 1 ? "s" : ""} planifiée
            {plannedCount > 1 ? "s" : ""} seront partagées en lecture seule
            {reviewerName ? ` avec ${reviewerName}` : ""} dans le portail de validation.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Le client voit la grille telle qu'elle sera publiée (rendu final).</li>
          <li>Il peut approuver ou commenter tuile par tuile.</li>
          <li>Aperçu — aucun email n'est envoyé pendant la preview.</li>
        </ul>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={confirm}>
            <Send />
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
