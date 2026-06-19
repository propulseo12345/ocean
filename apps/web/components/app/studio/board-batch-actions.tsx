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
import { pick, type Translator, useLocale, useT } from "@/lib/i18n"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { LabelEditor } from "./board-label-popover"
import { BoardScheduleDialog } from "./board-schedule-dialog"
import type { BoardState } from "./board-state"
import { canCancel, canSchedule, canSendReview } from "./board-utils"

// Actions en lot du studio : envoyer en validation, programmer en série,
// étiqueter, archiver, annuler — mutations locales + toasts (aperçu).

function ignoredSuffix(t: Translator, ignored: number): string {
  return ignored > 0 ? t("studio.batch.ignoredSuffix", { count: ignored }) : ""
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
  const t = useT()
  const { locale } = useLocale()
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
      toast.info(t("studio.batch.noReviewEligible"), {
        description: t("studio.batch.noReviewEligibleDesc"),
      })
    }
  }

  function openSchedule() {
    if (schedulable.length > 0) {
      setScheduleOpen(true)
    } else {
      toast.info(t("studio.batch.noSchedulable"), {
        description: t("studio.batch.noSchedulableDesc"),
      })
    }
  }

  function archive() {
    board.archiveBatch(selection.selectedIds)
    toast.success(t("studio.batch.archived", { count: selected.length }), {
      description: t("studio.batch.archivedDesc"),
    })
    selection.clear()
  }

  function cancel() {
    const ids = cancelable.map((it) => it.id)
    if (ids.length === 0) {
      toast.info(t("studio.batch.nothingToCancel"), {
        description: t("studio.batch.nothingToCancelDesc"),
      })
      return
    }
    board.setStatusBatch(ids, "canceled")
    toast.success(
      t("studio.batch.canceled", {
        count: ids.length,
        ignored: ignoredSuffix(t, selected.length - ids.length),
      })
    )
    selection.clear()
  }

  return (
    <>
      <SelectionBar count={selection.count} onClear={selection.clear}>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={openReview}>
          <Send />
          {t("studio.batch.sendReview")}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={openSchedule}>
          <CalendarClock />
          {t("studio.batch.schedule")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => setLabelOpen(true)}
        >
          <Tag />
          {t("studio.batch.tag")}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={archive}>
          <Archive />
          {t("studio.batch.archive")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={cancel}
        >
          <Ban />
          {t("studio.batch.cancel")}
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
            t("studio.batch.scheduled", {
              count: schedulable.length,
              ignored: ignoredSuffix(t, selected.length - schedulable.length),
            })
          )
          selection.clear()
        }}
      />

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("studio.batch.tagDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("studio.batch.tagDialogDesc", { count: selected.length })}
            </DialogDescription>
          </DialogHeader>
          <LabelEditor
            key={labelOpen ? "open" : "closed"}
            allLabels={allLabels}
            initial={[]}
            applyLabel={t("studio.batch.tagApply")}
            onApply={(labels) => {
              if (labels.length > 0) {
                board.addLabelsBatch(
                  selection.selectedIds,
                  labels,
                  new Map(
                    selected.map((it) => [it.id, (it.labels ?? []).map((l) => pick(l, locale))])
                  )
                )
                toast.success(t("studio.batch.tagsAdded"), {
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
