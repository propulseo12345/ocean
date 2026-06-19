"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useState } from "react"
import { toast } from "sonner"
import { useLabels, useT } from "@/lib/i18n"
import { days, fromNow } from "@/lib/mocks/time"
import type { Client, ContentItem, ContentStatus } from "@/lib/mocks/types"
import { KanbanCard, KanbanColumn } from "./board-kanban-card"
import type { BoardState } from "./board-state"
import { KANBAN_COLUMNS, type KanbanColumnId, kanbanColumnOf } from "./board-types"
import { wallClockIn, zonedToUtcIso } from "./composer/composer-utils"

// Kanban de production : Idée · Brouillon · En validation · Validé ·
// Programmé · Publié. Drag-and-drop avec règles de la machine à états :
// jamais de dépôt en « Publié », « Validé » réservé aux clients en
// publication directe (approvalMode auto).

const TOUCH_DELAY_MS = 220
const TOUCH_TOLERANCE_PX = 8
const POINTER_DISTANCE_PX = 6

const TO_REVIEW_FROM: ContentStatus[] = ["idea", "draft", "changes_requested", "approved"]
const TO_DRAFT_FROM: ContentStatus[] = [
  "idea",
  "in_review",
  "changes_requested",
  "approved",
  "failed",
  "scheduled",
]
const TO_SCHEDULED_FROM: ContentStatus[] = ["idea", "draft", "approved", "failed"]

export function BoardKanban({
  items,
  client,
  board,
}: {
  items: ContentItem[]
  client: Client
  board: BoardState
}) {
  const t = useT()
  const lbl = useLabels()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX },
    })
  )

  function move(item: ContentItem, target: KanbanColumnId) {
    if (kanbanColumnOf(item.status) === target) return
    if (target === "published") {
      toast.info(t("studio.kanban.cannotDropPublished"), {
        description: t("studio.kanban.cannotDropPublishedDesc"),
      })
    } else if (target === "approved") {
      if (client.approvalMode === "auto") {
        board.setStatusBatch([item.id], "approved")
        toast.success(t("studio.kanban.markedApproved"), {
          description: t("studio.kanban.markedApprovedDesc", { name: client.name }),
        })
      } else {
        toast.info(t("studio.kanban.reviewRequired"), {
          description: t("studio.kanban.reviewRequiredDesc", {
            name: client.name,
            mode: lbl.approvalMode(client.approvalMode).toLowerCase(),
          }),
        })
      }
    } else if (target === "in_review") {
      if (TO_REVIEW_FROM.includes(item.status)) {
        board.setStatusBatch([item.id], "in_review")
        toast.success(t("studio.kanban.sentToReview"))
      } else {
        toast.info(t("studio.kanban.cannotReview"), {
          description: t("studio.kanban.cannotReviewDesc"),
        })
      }
    } else if (target === "draft") {
      if (TO_DRAFT_FROM.includes(item.status)) {
        board.setStatusBatch([item.id], "draft")
        toast.success(t("studio.kanban.backToDraft"), {
          description: item.status === "approved" ? t("studio.kanban.backToDraftDesc") : undefined,
        })
      }
    } else if (target === "idea") {
      if (item.status === "draft") {
        board.setStatusBatch([item.id], "idea")
        toast.success(t("studio.kanban.backToIdea"))
      } else {
        toast.info(t("studio.kanban.onlyDraftToIdea"))
      }
    } else if (target === "scheduled") {
      if (!TO_SCHEDULED_FROM.includes(item.status)) {
        toast.info(t("studio.kanban.cannotSchedule"), {
          description: t("studio.kanban.cannotScheduleDesc"),
        })
        return
      }
      if (item.scheduledAt && item.scheduledAt > fromNow(0)) {
        board.setStatusBatch([item.id], "scheduled")
        toast.success(t("studio.kanban.scheduled"))
      } else {
        const wc = wallClockIn(fromNow(days(1)), client.timezone)
        board.scheduleBatch(
          [item.id],
          zonedToUtcIso(wc.year, wc.month, wc.day, 9, 0, client.timezone),
          0
        )
        toast.success(t("studio.kanban.scheduledTomorrow"), {
          description: t("studio.kanban.scheduledTomorrowDesc"),
        })
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const overId = event.over?.id
    if (typeof overId !== "string" || !overId.startsWith("col:")) return
    const item = items.find((it) => it.id === event.active.id)
    if (item) move(item, overId.slice("col:".length) as KanbanColumnId)
  }

  const activeItem = activeId ? items.find((it) => it.id === activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={t(col.labelKey)}
            items={items.filter((it) => kanbanColumnOf(it.status) === col.id)}
            client={client}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-52">
            <KanbanCard item={activeItem} client={client} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
