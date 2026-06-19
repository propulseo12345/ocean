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
import { approvalModeMeta } from "@/lib/mocks/labels"
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
      toast.info("Impossible de déposer en « Publié »", {
        description:
          "La publication passe par le moteur Ocean ou le centre de publication manuelle.",
      })
    } else if (target === "approved") {
      if (client.approvalMode === "auto") {
        board.setStatusBatch([item.id], "approved")
        toast.success("Marqué validé (aperçu)", {
          description: `${client.name} est en publication directe — pas de validation client requise.`,
        })
      } else {
        toast.info("Validation client requise", {
          description: `${client.name} est en « ${approvalModeMeta[client.approvalMode].label.toLowerCase()} » — passe par « Demander une validation ».`,
        })
      }
    } else if (target === "in_review") {
      if (TO_REVIEW_FROM.includes(item.status)) {
        board.setStatusBatch([item.id], "in_review")
        toast.success("Envoyé en validation (aperçu)")
      } else {
        toast.info("Ce contenu ne peut pas partir en revue", {
          description: "Seuls les idées, brouillons et contenus validés sont éligibles.",
        })
      }
    } else if (target === "draft") {
      if (TO_DRAFT_FROM.includes(item.status)) {
        board.setStatusBatch([item.id], "draft")
        toast.success("Repassé en brouillon (aperçu)", {
          description:
            item.status === "approved" ? "L'approbation client est invalidée." : undefined,
        })
      }
    } else if (target === "idea") {
      if (item.status === "draft") {
        board.setStatusBatch([item.id], "idea")
        toast.success("Reversé à la banque d'idées (aperçu)")
      } else {
        toast.info("Seul un brouillon peut repartir en idée")
      }
    } else if (target === "scheduled") {
      if (!TO_SCHEDULED_FROM.includes(item.status)) {
        toast.info("Programmation impossible", {
          description: "Corrige d'abord les retours ou repasse le contenu en brouillon.",
        })
        return
      }
      if (item.scheduledAt && item.scheduledAt > fromNow(0)) {
        board.setStatusBatch([item.id], "scheduled")
        toast.success("Programmé (aperçu)")
      } else {
        const wc = wallClockIn(fromNow(days(1)), client.timezone)
        board.scheduleBatch(
          [item.id],
          zonedToUtcIso(wc.year, wc.month, wc.day, 9, 0, client.timezone),
          0
        )
        toast.success("Programmé demain 9 h (aperçu)", {
          description: "Ajuste le créneau depuis le détail ou le calendrier.",
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
            label={col.label}
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
