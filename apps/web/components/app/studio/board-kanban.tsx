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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { scheduleContentItem } from "@/lib/actions/content"
import { applyStatusIntent } from "@/lib/actions/content-status"
import { days, fromNow } from "@/lib/clock"
import type { Client, ContentItem, ContentStatus } from "@/lib/domain"
import { canApplyIntent, type StatusIntent } from "@/lib/domain/content-status"
import { useLabels, useT } from "@/lib/i18n"
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

// Les listes de statuts sources vivaient ici, codées en dur, et avaient dérivé
// de la garde SQL 008 : `approved -> in_review` et `changes_requested ->
// in_review` étaient proposés alors que la base les refuse (42501 au clic), et
// `draft -> idea` était proposé alors qu'il n'existait pas en base. La matrice
// est désormais partagée avec les Server Actions et miroir de 008/016.
// Voir lib/domain/content-status.ts.

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
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX },
    })
  )

  // Persistance optimiste : l'override local est déjà appliqué (UX fluide) ; on
  // écrit en arrière-plan et on ROLLBACK vers le statut d'origine si la Server
  // Action échoue. La garde 008/016 est revérifiée côté serveur.
  function persistStatus(item: ContentItem, intent: StatusIntent, prev: ContentStatus) {
    applyStatusIntent({ clientId: client.id, contentId: item.id, intent }).then((res) => {
      if (!res.ok) {
        board.setStatusBatch([item.id], prev)
        toast.error(t("studio.kanban.statusError"))
      } else {
        router.refresh()
      }
    })
  }

  // Programmation depuis une date par défaut : bascule le statut (schedule) PUIS
  // fixe la date. Deux écritures distinctes, cohérentes avec les Server Actions.
  function persistSchedule(item: ContentItem, iso: string, prev: ContentStatus) {
    applyStatusIntent({ clientId: client.id, contentId: item.id, intent: "schedule" }).then(
      (res) => {
        if (!res.ok) {
          board.setStatusBatch([item.id], prev)
          toast.error(t("studio.kanban.statusError"))
          return
        }
        scheduleContentItem({ clientId: client.id, contentId: item.id, scheduledAt: iso }).then(
          (r2) => {
            if (!r2.ok) toast.error(t("studio.kanban.statusError"))
            router.refresh()
          }
        )
      }
    )
  }

  function move(item: ContentItem, target: KanbanColumnId) {
    if (kanbanColumnOf(item.status) === target) return
    const prev = item.status
    if (target === "published") {
      toast.info(t("studio.kanban.cannotDropPublished"), {
        description: t("studio.kanban.cannotDropPublishedDesc"),
      })
    } else if (target === "approved") {
      if (client.approvalMode === "auto" && canApplyIntent("approve", item.status)) {
        board.setStatusBatch([item.id], "approved")
        persistStatus(item, "approve", prev)
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
      if (canApplyIntent("send_to_review", item.status)) {
        board.setStatusBatch([item.id], "in_review")
        persistStatus(item, "send_to_review", prev)
        toast.success(t("studio.kanban.sentToReview"))
      } else {
        toast.info(t("studio.kanban.cannotReview"), {
          description: t("studio.kanban.cannotReviewDesc"),
        })
      }
    } else if (target === "draft") {
      if (canApplyIntent("back_to_draft", item.status)) {
        board.setStatusBatch([item.id], "draft")
        persistStatus(item, "back_to_draft", prev)
        toast.success(t("studio.kanban.backToDraft"), {
          description: item.status === "approved" ? t("studio.kanban.backToDraftDesc") : undefined,
        })
      }
    } else if (target === "idea") {
      if (canApplyIntent("back_to_idea", item.status)) {
        board.setStatusBatch([item.id], "idea")
        persistStatus(item, "back_to_idea", prev)
        toast.success(t("studio.kanban.backToIdea"))
      } else {
        toast.info(t("studio.kanban.onlyDraftToIdea"))
      }
    } else if (target === "scheduled") {
      if (!canApplyIntent("schedule", item.status)) {
        toast.info(t("studio.kanban.cannotSchedule"), {
          description: t("studio.kanban.cannotScheduleDesc"),
        })
        return
      }
      if (item.scheduledAt && item.scheduledAt > fromNow(0)) {
        board.setStatusBatch([item.id], "scheduled")
        persistStatus(item, "schedule", prev)
        toast.success(t("studio.kanban.scheduled"))
      } else {
        const wc = wallClockIn(fromNow(days(1)), client.timezone)
        const iso = zonedToUtcIso(wc.year, wc.month, wc.day, 9, 0, client.timezone)
        board.scheduleBatch([item.id], iso, 0)
        persistSchedule(item, iso, prev)
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
