"use client"

import { useDraggable, useDroppable } from "@dnd-kit/core"
import Link from "next/link"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { StatusDot } from "@/components/shared/status-dot"
import { pick, useFormat, useLocale, useT } from "@/lib/i18n"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { KANBAN_LOCKED, type KanbanColumnId, labelColorVar } from "./board-types"

// Briques visuelles du kanban : carte compacte, carte draggable, colonne.

export function KanbanCard({
  item,
  client,
  dragging,
}: {
  item: ContentItem
  client: Client
  dragging?: boolean
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const cover = item.media[0]
  return (
    <div
      className={cn("space-y-1.5 rounded-lg border bg-card p-2 shadow-xs", dragging && "shadow-lg")}
    >
      <div className="flex items-start gap-2">
        {cover ? (
          <MediaThumb media={cover} alt="" className="size-9 shrink-0 rounded-md" sizes="36px" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FormatIcon format={item.format} className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={routes.content(client.id, item.id)}
            draggable={false}
            className="line-clamp-2 text-xs leading-snug font-medium hover:underline"
          >
            {pick(item.title, locale)}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
            <StatusDot status={item.status} />
            {item.scheduledAt
              ? f.dayMonth(item.scheduledAt, client.timezone)
              : t("studio.kanban.noDate")}
            {item.status === "changes_requested" ? (
              <span className="font-medium text-warning">{t("studio.kanban.changes")}</span>
            ) : null}
            {item.status === "failed" ? (
              <span className="font-medium text-destructive">{t("studio.kanban.failed")}</span>
            ) : null}
          </p>
        </div>
      </div>
      {item.labels && item.labels.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1">
          {item.labels.map((label) => {
            const text = pick(label, locale)
            return (
              <span
                key={text}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: labelColorVar(text) }}
                />
                {text}
              </span>
            )
          })}
        </p>
      ) : null}
    </div>
  )
}

export function DraggableKanbanCard({ item, client }: { item: ContentItem; client: Client }) {
  const locked = KANBAN_LOCKED.includes(item.status)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: locked,
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("touch-manipulation", isDragging && "opacity-40", locked && "opacity-80")}
    >
      <KanbanCard item={item} client={client} />
    </div>
  )
}

export function KanbanColumn({
  id,
  label,
  items,
  client,
}: {
  id: KanbanColumnId
  label: string
  items: ContentItem[]
  client: Client
}) {
  const t = useT()
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` })
  return (
    <section
      ref={setNodeRef}
      aria-label={t("studio.kanban.columnAria", { label })}
      className={cn(
        "flex w-56 shrink-0 flex-col gap-1.5 rounded-xl border bg-card/40 p-2 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <p className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
        {label}
        <span className="tabular-nums">{items.length}</span>
      </p>
      {items.map((item) => (
        <DraggableKanbanCard key={item.id} item={item} client={client} />
      ))}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
          {t("studio.kanban.dropHere")}
        </p>
      ) : null}
    </section>
  )
}
