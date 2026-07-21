"use client"

import { CalendarClock, Copy, Lock, Pencil, Send, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { trashContent } from "@/lib/actions/content"
import type { Client, ContentStatus } from "@/lib/domain"
import { type MessageKey, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { DetailDuplicateDialog } from "./detail-duplicate-dialog"

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
  const t = useT()
  const router = useRouter()
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [trashing, setTrashing] = useState(false)
  const isReadOnly = READ_ONLY.includes(status)
  const sim = (key: MessageKey) => () =>
    toast.success(t(key), { description: t("studio.actions.simulated") })

  // Bouton destructif → corbeille (soft-delete restaurable). Après succès, on
  // quitte le détail : le contenu n'est plus chargé par le loader (deleted_at).
  async function handleTrash() {
    if (trashing) return
    setTrashing(true)
    const res = await trashContent({ clientId, contentId })
    if (!res.ok) {
      setTrashing(false)
      toast.error(t("studio.actions.trashError"))
      return
    }
    toast.success(t("studio.actions.trashedToast"), { description: contentTitle })
    router.push(routes.clientContent(clientId))
    router.refresh()
  }

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
          <AlertTitle>{t("studio.actions.readOnlyTitle")}</AlertTitle>
          <AlertDescription>{t("studio.actions.readOnlyDesc")}</AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={() => setDuplicateOpen(true)}>
          <Copy />
          {t("studio.actions.duplicateContent")}
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
          {t("studio.actions.editContent")}
        </Button>
      ) : null}

      <Button variant="outline" onClick={() => setDuplicateOpen(true)}>
        <Copy />
        {t("studio.actions.duplicate")}
      </Button>

      <Button variant="destructive" onClick={handleTrash} disabled={trashing}>
        <XCircle />
        {status === "scheduled" ? t("studio.actions.cancelSchedule") : t("studio.actions.abandon")}
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
  onAction: (key: MessageKey) => () => void
  onDuplicate: () => void
}) {
  const t = useT()
  switch (status) {
    case "idea":
    case "draft":
      return (
        <>
          <Button onClick={onAction("studio.actions.toastScheduled")}>
            <CalendarClock />
            {t("studio.actions.schedule")}
          </Button>
          <Button variant="secondary" onClick={onAction("studio.actions.toastSentReview")}>
            <Send />
            {t("studio.actions.sendReview")}
          </Button>
        </>
      )
    case "changes_requested":
      return (
        <Button onClick={onAction("studio.actions.toastNewVersion")}>
          <Send />
          {t("studio.actions.resendReview")}
        </Button>
      )
    case "in_review":
      return (
        <Button variant="outline" onClick={onAction("studio.actions.toastReviewRemoved")}>
          <XCircle />
          {t("studio.actions.removeFromReview")}
        </Button>
      )
    case "approved":
      return (
        <Button onClick={onAction("studio.actions.toastScheduled")}>
          <CalendarClock />
          {t("studio.actions.schedule")}
        </Button>
      )
    case "scheduled":
      return (
        <Button onClick={onAction("studio.actions.toastDateChanged")}>
          <CalendarClock />
          {t("studio.actions.editDate")}
        </Button>
      )
    case "failed":
      return (
        <Button onClick={onAction("studio.actions.toastFailedRescheduled")}>
          <CalendarClock />
          {t("studio.actions.rescheduleFailed")}
        </Button>
      )
    default:
      return (
        <Button onClick={onDuplicate}>
          <Copy />
          {t("studio.actions.duplicate")}
        </Button>
      )
  }
}
