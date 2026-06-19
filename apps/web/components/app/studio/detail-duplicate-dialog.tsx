"use client"

import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Client } from "@/lib/mocks/types"

// Duplication d'un contenu : copie pour le même client, ou vers un autre
// client avec adaptation des hashtags. Les médias ne traversent JAMAIS d'un
// client à l'autre (étanchéité par tenant) — re-sélection en médiathèque.

export function DetailDuplicateDialog({
  open,
  onOpenChange,
  clients,
  currentClientId,
  contentTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  currentClientId: string
  contentTitle: string
}) {
  const [targetId, setTargetId] = useState(currentClientId)
  const [adaptHashtags, setAdaptHashtags] = useState(true)

  const target = clients.find((c) => c.id === targetId)
  const crossClient = targetId !== currentClientId

  function confirm() {
    if (!target) return
    toast.success(`Contenu dupliqué vers ${target.name}`, {
      description: crossClient
        ? `Copie en brouillon${adaptHashtags ? ", hashtags adaptés au client cible" : ""} — médias à re-sélectionner dans sa médiathèque (aperçu).`
        : "Copie en brouillon, médias et légende inclus (aperçu).",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dupliquer le contenu</DialogTitle>
          <DialogDescription className="truncate">{contentTitle}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={targetId}
          onValueChange={(v) => setTargetId(String(v))}
          aria-label="Client de destination"
          className="gap-1.5"
        >
          {clients.map((client) => (
            <Label
              key={client.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 font-normal has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={client.id} />
              <ClientAvatar client={client} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {client.name}
                  {client.id === currentClientId ? " (ce client)" : ""}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{client.handle}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            checked={adaptHashtags}
            onCheckedChange={(checked) => setAdaptHashtags(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm">Adapter les hashtags au client cible</span>
            <span className="block text-xs text-muted-foreground">
              Remplace les hashtags par les groupes du client de destination (aperçu).
            </span>
          </span>
        </Label>

        {crossClient && target ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            Les médias ne traversent jamais d'un client à l'autre : re-sélectionne les visuels dans
            la médiathèque de {target.name}.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={confirm}>Dupliquer (aperçu)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
