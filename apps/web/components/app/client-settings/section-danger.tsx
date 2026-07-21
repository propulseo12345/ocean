"use client"

import { Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { nowIso } from "@/lib/clock"
import { useFormat, useT } from "@/lib/i18n"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { ConfirmDialog } from "./confirm-dialog"
import { DeleteClientDialog } from "./delete-client-dialog"
import { SectionCard } from "./section-card"
import { TrashList } from "./trash-list"

export function SectionDanger({ client, trashed }: { client: Client; trashed: ContentItem[] }) {
  const t = useT()
  const f = useFormat()
  const [archivedAt, setArchivedAt] = useState(client.archivedAt)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isArchived = archivedAt !== null

  function archive() {
    setArchivedAt(nowIso())
    setConfirmArchive(false)
    toast.success(t("clientSettings.danger.archivedToast"), {
      description: t("clientSettings.danger.archivedToastDescription"),
    })
  }

  function reactivate() {
    setArchivedAt(null)
    toast.success(t("clientSettings.danger.reactivatedToast"), {
      description: t("clientSettings.danger.reactivatedToastDescription"),
    })
  }

  function deleteClient() {
    setConfirmDelete(false)
    toast.error(t("clientSettings.danger.deletedToast"), {
      description: t("clientSettings.danger.deletedToastDescription"),
    })
  }

  return (
    <SectionCard
      icon={Archive}
      title={t("clientSettings.danger.title")}
      description={t("clientSettings.danger.description")}
    >
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isArchived
              ? t("clientSettings.danger.archivedTitle")
              : t("clientSettings.danger.archiveTitle")}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {isArchived && archivedAt
              ? t("clientSettings.danger.archivedOn", { date: f.date(archivedAt) })
              : t("clientSettings.danger.archiveHint")}
          </p>
        </div>
        {isArchived ? (
          <Button size="sm" variant="outline" onClick={reactivate} className="shrink-0">
            <ArchiveRestore />
            {t("clientSettings.danger.reactivate")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmArchive(true)}
            className="shrink-0"
          >
            <Archive />
            {t("clientSettings.danger.archive")}
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        <p className="text-sm font-medium">{t("clientSettings.danger.trashTitle")}</p>
        <TrashList items={trashed} />
      </div>

      <Card className="border-destructive/30 bg-destructive/[0.03] ring-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="size-4" />
            {t("clientSettings.danger.dangerZone")}
          </CardTitle>
          <CardDescription>{t("clientSettings.danger.dangerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            {t("clientSettings.danger.deletePermanently")}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("clientSettings.danger.archiveDialogTitle")}
        description={t("clientSettings.danger.archiveDialogDescription")}
        confirmLabel={t("clientSettings.danger.archiveConfirm")}
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
