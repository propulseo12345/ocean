"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { createContext, type ReactNode, useContext, useState } from "react"
import { FormatIcon } from "@/components/shared/format-icon"
import { formatTime } from "@/lib/format"
import { pick, useLocale } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import type { DayKey } from "./calendar-utils"

// Contexte drag-and-drop du calendrier : cartes (contenus) → cases (jours).
// Ids droppables : `day:<YYYY-MM-DD>` ; ids draggables : id du contenu.

const TOUCH_DELAY_MS = 220
const TOUCH_TOLERANCE_PX = 8
const POINTER_DISTANCE_PX = 6

const DragActiveContext = createContext(false)

/** Vrai pendant un drag (les cases passées se grisent). */
export function useDragActive(): boolean {
  return useContext(DragActiveContext)
}

export function droppableDayId(key: DayKey): string {
  return `day:${key}`
}

export function CalendarDnd({
  items,
  tz,
  onDrop,
  children,
}: {
  items: ContentItem[]
  tz: string
  /** Appelé au relâchement sur une case valide. */
  onDrop: (item: ContentItem, dayKey: DayKey) => void
  children: ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const overId = event.over?.id
    if (typeof overId !== "string" || !overId.startsWith("day:")) return
    const item = items.find((it) => it.id === event.active.id)
    if (!item) return
    onDrop(item, overId.slice("day:".length))
  }

  const activeItem = activeId !== null ? items.find((it) => it.id === activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <DragActiveContext.Provider value={activeId !== null}>
        {children}
        <DragOverlay dropAnimation={null}>
          {activeItem ? <DragGhost item={activeItem} tz={tz} /> : null}
        </DragOverlay>
      </DragActiveContext.Provider>
    </DndContext>
  )
}

function DragGhost({ item, tz }: { item: ContentItem; tz: string }) {
  const { locale } = useLocale()
  return (
    <div className="flex w-44 items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs shadow-lg">
      <FormatIcon format={item.format} className="size-3 shrink-0 text-muted-foreground" />
      {item.scheduledAt ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {formatTime(item.scheduledAt, tz)}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-medium">{pick(item.title, locale)}</span>
    </div>
  )
}
