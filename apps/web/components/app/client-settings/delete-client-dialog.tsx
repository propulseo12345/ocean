"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"
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
  const t = useT()
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
      title={t("clientSettings.deleteDialog.title")}
      description={t("clientSettings.deleteDialog.description")}
      confirmLabel={t("clientSettings.deleteDialog.confirm")}
      disabled={!matches}
      onConfirm={() => {
        onConfirm()
        setTyped("")
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-name">
          {t("clientSettings.deleteDialog.confirmLabel", { name: client.name })}
        </Label>
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
