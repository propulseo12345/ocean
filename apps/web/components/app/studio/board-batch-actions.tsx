"use client"

import { Archive, Ban, CalendarClock, Send, Tag } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SelectionBar } from "@/components/shared/selection-bar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UseMultiSelectResult } from "@/hooks/use-multi-select"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { LabelEditor } from "./board-label-popover"
import { BoardScheduleDialog } from "./board-schedule-dialog"
import type { BoardState } from "./board-state"
import { canCancel, canSchedule, canSendReview } from "./board-utils"

// Actions en lot du studio : envoyer en validation, programmer en série,
// étiqueter, archiver, annuler — mutations locales + toasts (aperçu).

function ignoredSuffix(ignored: number): string {
  return ignored > 0 ? ` · ${ignored} ignoré${ignored > 1 ? "s" : ""} (statut incompatible)` : ""
}

export function BoardBatchActions({
  board,
  selection,
  client,
  allLabels,
  onOpenReview,
}: {
  board: BoardState
  selection: UseMultiSelectResult
  client: Client
  allLabels: string[]
  onOpenReview: () => void
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)

  const selected: ContentItem[] = board.boardItems.filter((it) =>
    selection.selectedIds.includes(it.id)
  )
  const schedulable = selected.filter(canSchedule)
  const cancelable = selected.filter(canCancel)

  function openReview() {
    if (selected.some(canSendReview)) {
      onOpenReview()
    } else {
      toast.info("Aucun contenu éligible à la validation", {
        description: "Seuls les brouillons et retours corrigés peuvent partir en revue.",
      })
    }
  }

  function openSchedule() {
    if (schedulable.length > 0) {
      setScheduleOpen(true)
    } else {
      toast.info("Aucun contenu programmable", {
        description: "Seuls les idées, brouillons et contenus validés peuvent être programmés.",
      })
    }
  }

  function archive() {
    board.archiveBatch(selection.selectedIds)
    toast.success(
      `${selected.length} contenu${selected.length > 1 ? "s" : ""} archivé${selected.length > 1 ? "s" : ""} (aperçu)`,
      {
        description: "Retirés du studio — restaurables depuis la corbeille du client.",
      }
    )
    selection.clear()
  }

  function cancel() {
    const ids = cancelable.map((it) => it.id)
    if (ids.length === 0) {
      toast.info("Rien à annuler", {
        description: "Les contenus déjà publiés ou en cours de publication sont verrouillés.",
      })
      return
    }
    board.setStatusBatch(ids, "canceled")
    toast.success(
      `${ids.length} contenu${ids.length > 1 ? "s" : ""} annulé${ids.length > 1 ? "s" : ""} (aperçu)${ignoredSuffix(selected.length - ids.length)}`
    )
    selection.clear()
  }

  return (
    <>
      <SelectionBar count={selection.count} onClear={selection.clear}>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={openReview}>
          <Send />
          Envoyer en validation
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={openSchedule}>
          <CalendarClock />
          Programmer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => setLabelOpen(true)}
        >
          <Tag />
          Étiqueter
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={archive}>
          <Archive />
          Archiver
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={cancel}
        >
          <Ban />
          Annuler
        </Button>
      </SelectionBar>

      <BoardScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        count={schedulable.length}
        client={client}
        onConfirm={(startIso, gapDays) => {
          board.scheduleBatch(
            schedulable.map((it) => it.id),
            startIso,
            gapDays
          )
          setScheduleOpen(false)
          toast.success(
            `${schedulable.length} contenu${schedulable.length > 1 ? "s" : ""} programmé${schedulable.length > 1 ? "s" : ""} (aperçu)${ignoredSuffix(selected.length - schedulable.length)}`
          )
          selection.clear()
        }}
      />

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Étiqueter la sélection</DialogTitle>
            <DialogDescription>
              Les étiquettes cochées s'ajoutent aux {selected.length} contenu
              {selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <LabelEditor
            key={labelOpen ? "open" : "closed"}
            allLabels={allLabels}
            initial={[]}
            applyLabel="Ajouter aux contenus (aperçu)"
            onApply={(labels) => {
              if (labels.length > 0) {
                board.addLabelsBatch(
                  selection.selectedIds,
                  labels,
                  new Map(selected.map((it) => [it.id, it.labels ?? []]))
                )
                toast.success("Étiquettes ajoutées (aperçu)", {
                  description: labels.join(" · "),
                })
              }
              setLabelOpen(false)
              selection.clear()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
