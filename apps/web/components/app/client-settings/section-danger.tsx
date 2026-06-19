"use client"

import { Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { ConfirmDialog } from "./confirm-dialog"
import { DeleteClientDialog } from "./delete-client-dialog"
import { SectionCard } from "./section-card"
import { TrashList } from "./trash-list"

export function SectionDanger({ client, trashed }: { client: Client; trashed: ContentItem[] }) {
  const [archivedAt, setArchivedAt] = useState(client.archivedAt)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isArchived = archivedAt !== null

  function archive() {
    setArchivedAt(MOCK_NOW.toISOString())
    setConfirmArchive(false)
    toast.success("Client archivé (aperçu)", {
      description: "Il disparaît des listes actives ; ses contenus restent conservés.",
    })
  }

  function reactivate() {
    setArchivedAt(null)
    toast.success("Client réactivé (aperçu)", {
      description: "Il réapparaît dans la liste active et le switcher.",
    })
  }

  function deleteClient() {
    setConfirmDelete(false)
    toast.error("Suppression définitive simulée (aperçu)", {
      description: "Aucun client n'est réellement supprimé pendant la preview.",
    })
  }

  return (
    <SectionCard
      icon={Archive}
      title="Archivage & corbeille"
      description="Mettre le client en pause, restaurer des contenus supprimés ou tout effacer."
    >
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isArchived ? "Client archivé" : "Archiver le client"}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {isArchived && archivedAt
              ? `Archivé le ${formatDate(archivedAt)}. Réactive-le pour reprendre la collaboration.`
              : "Il n'apparaîtra plus dans la liste active ni le switcher ; ses contenus sont conservés."}
          </p>
        </div>
        {isArchived ? (
          <Button size="sm" variant="outline" onClick={reactivate} className="shrink-0">
            <ArchiveRestore />
            Réactiver
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmArchive(true)}
            className="shrink-0"
          >
            <Archive />
            Archiver
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        <p className="text-sm font-medium">Corbeille</p>
        <TrashList items={trashed} />
      </div>

      <Card className="border-destructive/30 bg-destructive/[0.03] ring-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="size-4" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            Suppression définitive du client et de toutes ses données. Aucune réversibilité.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            Supprimer définitivement le client
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archiver ce client ?"
        description="Il disparaîtra des listes actives et du switcher. Ses contenus et son historique restent conservés, et tu pourras le réactiver à tout moment."
        confirmLabel="Archiver (aperçu)"
        destructive={false}
        onConfirm={archive}
      />

      <DeleteClientDialog
        client={client}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={deleteClient}
      />
    </SectionCard>
  )
}
