"use client"

import { CalendarClock, Copy, Lock, Pencil, Send, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Client, ContentStatus } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { DetailDuplicateDialog } from "./detail-duplicate-dialog"

const SIM = "Action simulée (preview)"

// Statuts en lecture seule (édition interdite à partir de publishing — §5.B).
const READ_ONLY: ContentStatus[] = ["publishing", "published", "partially_published"]

export function ContentActions({
  status,
  clientId,
  contentId,
  contentTitle,
  clients,
}: {
  status: ContentStatus
  clientId: string
  contentId: string
  contentTitle: string
  clients: Client[]
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const isReadOnly = READ_ONLY.includes(status)
  const sim = (label: string) => () => toast.success(label, { description: SIM })

  const duplicateDialog = (
    <DetailDuplicateDialog
      open={duplicateOpen}
      onOpenChange={setDuplicateOpen}
      clients={clients}
      currentClientId={clientId}
      contentTitle={contentTitle}
    />
  )

  if (isReadOnly) {
    return (
      <div className="space-y-3">
        <Alert>
          <Lock />
          <AlertTitle>Contenu en lecture seule</AlertTitle>
          <AlertDescription>
            La publication a commencé. Duplique le contenu pour repartir d'une nouvelle version.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={() => setDuplicateOpen(true)}>
          <Copy />
          Dupliquer le contenu
        </Button>
        {duplicateDialog}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <PrimaryAction status={status} onAction={sim} onDuplicate={() => setDuplicateOpen(true)} />

      {status !== "in_review" ? (
        <Button variant="outline" render={<Link href={routes.contentEdit(clientId, contentId)} />}>
          <Pencil />
          Modifier le contenu
        </Button>
      ) : null}

      <Button variant="outline" onClick={() => setDuplicateOpen(true)}>
        <Copy />
        Dupliquer
      </Button>

      <Button variant="destructive" onClick={sim("Programmation annulée")}>
        <XCircle />
        {status === "scheduled" ? "Annuler la programmation" : "Abandonner"}
      </Button>

      {duplicateDialog}
    </div>
  )
}

function PrimaryAction({
  status,
  onAction,
  onDuplicate,
}: {
  status: ContentStatus
  onAction: (label: string) => () => void
  onDuplicate: () => void
}) {
  switch (status) {
    case "idea":
    case "draft":
      return (
        <>
          <Button onClick={onAction("Contenu programmé")}>
            <CalendarClock />
            Programmer
          </Button>
          <Button variant="secondary" onClick={onAction("Envoyé en revue")}>
            <Send />
            Envoyer en revue
          </Button>
        </>
      )
    case "changes_requested":
      return (
        <Button onClick={onAction("Nouvelle version envoyée en revue")}>
          <Send />
          Renvoyer en revue
        </Button>
      )
    case "in_review":
      return (
        <Button variant="outline" onClick={onAction("Revue retirée")}>
          <XCircle />
          Retirer de la revue
        </Button>
      )
    case "approved":
      return (
        <Button onClick={onAction("Contenu programmé")}>
          <CalendarClock />
          Programmer
        </Button>
      )
    case "scheduled":
      return (
        <Button onClick={onAction("Date modifiée")}>
          <CalendarClock />
          Modifier la date
        </Button>
      )
    case "failed":
      return (
        <Button onClick={onAction("Cibles en échec reprogrammées")}>
          <CalendarClock />
          Reprogrammer les échecs
        </Button>
      )
    default:
      return (
        <Button onClick={onDuplicate}>
          <Copy />
          Dupliquer
        </Button>
      )
  }
}
