"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Client } from "@/lib/mocks/types"
import { ConfirmDialog } from "./confirm-dialog"

// Suppression définitive du client : confirmation par saisie exacte du nom.

export function DeleteClientDialog({
  client,
  open,
  onOpenChange,
  onConfirm,
}: {
  client: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState("")
  const matches = typed.trim() === client.name

  function handleOpenChange(next: boolean) {
    if (!next) setTyped("")
    onOpenChange(next)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Supprimer définitivement le client ?"
      description={
        <>
          Cette action est irréversible : le client, ses contenus, son historique et ses médias sont
          supprimés. Préfère l'archivage si tu veux conserver les preuves.
        </>
      }
      confirmLabel="Supprimer définitivement (aperçu)"
      disabled={!matches}
      onConfirm={() => {
        onConfirm()
        setTyped("")
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-name">Saisis « {client.name} » pour confirmer</Label>
        <Input
          id="confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={client.name}
          autoComplete="off"
        />
      </div>
    </ConfirmDialog>
  )
}
