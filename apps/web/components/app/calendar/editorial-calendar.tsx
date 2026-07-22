"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { addClientEvent } from "@/lib/actions/client-events"
import type { ContentItem } from "@/lib/domain"
import { useLocale, useT } from "@/lib/i18n"
import { AutomationDialog } from "./automation-dialog"
import {
  performDrop,
  performDuplicate,
  performRemind,
  performReschedule,
  performRetry,
} from "./calendar-actions"
import { CalendarBanners } from "./calendar-banners"
import { CalendarControls } from "./calendar-controls"
import { CalendarDnd } from "./calendar-dnd"
import { CalendarFiltersBar } from "./calendar-filters"
import { CalendarLegend } from "./calendar-legend"
import { CalendarSelectionActions } from "./calendar-selection-actions"
import { CalendarToolbar } from "./calendar-toolbar"
import { type CalendarData, type DayContext, EMPTY_FILTERS } from "./calendar-types"
import { type DayKey, monthYearLabel, weekdayDayMonth } from "./calendar-utils"
import { DaySheet } from "./day-sheet"
import { DuplicateDialog } from "./duplicate-dialog"
import { ExportDialog } from "./export-dialog"
import { MonthGrid } from "./month-grid"
import { RescheduleDialog } from "./move-dialogs"
import { PlanningShelf } from "./planning-shelf"
import { useCalendarDerived, useCalendarShortcuts } from "./use-calendar-derived"
import { useCalendarState } from "./use-calendar-state"
import { useSwipe } from "./use-swipe"
import { WeekView } from "./week-view"

export function EditorialCalendar(props: CalendarData) {
  const t = useT()
  const { locale } = useLocale()
  const s = useCalendarState(props)
  const d = useCalendarDerived(s, props)
  const selection = useMultiSelect()
  const [sheetDay, setSheetDay] = useState<DayKey | null>(null)
  const [rescheduleItem, setRescheduleItem] = useState<ContentItem | null>(null)
  const [duplicateItem, setDuplicateItem] = useState<ContentItem | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)

  useCalendarShortcuts(s)
  const swipe = useSwipe(s.goNext, s.goPrev)

  const ctx: DayContext = useMemo(
    () => ({
      clientId: props.client.id,
      tz: s.tz,
      todayKey: s.todayKey,
      selectionMode: s.selectionMode,
      showMarronniers: s.showMarronniers,
      gapDays: d.gaps.gapDays,
      densityByDay: d.density,
      eventsByDay: s.eventsByDay,
      accountIssueIds: d.accountIssues,
      waitingDays: d.waiting,
      pillarById: d.pillarById,
      isSelected: selection.isSelected,
      onToggleSelect: selection.toggle,
      onOpenDay: setSheetDay,
      callbacks: {
        onReschedule: setRescheduleItem,
        onDuplicate: setDuplicateItem,
        onRetry: (item) => performRetry(item, t, locale),
        onRemind: () => performRemind(props.reviewerName, t),
      },
    }),
    [
      props.client.id,
      props.reviewerName,
      s.tz,
      s.todayKey,
      s.selectionMode,
      s.showMarronniers,
      s.eventsByDay,
      d.gaps.gapDays,
      d.density,
      d.accountIssues,
      d.waiting,
      d.pillarById,
      selection.isSelected,
      selection.toggle,
      t,
      locale,
    ]
  )

  const selectedItems = useMemo(
    () => s.effectiveItems.filter((it) => selection.isSelected(it.id)),
    [s.effectiveItems, selection.isSelected]
  )

  const periodLabel =
    s.view === "month"
      ? monthYearLabel(s.cursor, locale)
      : t("calendar.toolbar.weekOf", { date: weekdayDayMonth(s.weekDays[0], s.tz, locale) })

  return (
    <div className="space-y-3">
      <CalendarToolbar
        periodLabel={periodLabel}
        timezone={s.tz}
        view={s.view}
        cursor={s.cursor}
        onView={s.setView}
        onPrev={s.goPrev}
        onNext={s.goNext}
        onToday={s.goToday}
        onMonth={s.goMonth}
      />

      <CalendarControls
        monthPostCount={s.monthItems.length}
        gapCount={d.gaps.count}
        shelfCount={s.shelfItems.length}
        igQuota={props.igQuota}
        showMarronniers={s.showMarronniers}
        onToggleMarronniers={s.setShowMarronniers}
        legendOpen={s.legendOpen}
        onToggleLegend={() => s.setLegendOpen((v) => !v)}
        selectionMode={s.selectionMode}
        onToggleSelection={() => {
          if (s.selectionMode) selection.clear()
          s.setSelectionMode(!s.selectionMode)
        }}
        mixRows={d.mixRows}
        onOpenExport={() => setExportOpen(true)}
        onOpenAutomations={() => setAutoOpen(true)}
      />

      {s.legendOpen ? <CalendarLegend /> : null}

      <CalendarFiltersBar
        filters={s.filters}
        onChange={s.setFilters}
        onClear={s.clearFilters}
        pillars={props.pillars}
        visibleCount={s.counts.visible}
        maskedCount={s.counts.masked}
      />

      <CalendarBanners
        accounts={props.accounts}
        upcomingByAccount={d.upcomingByAccount}
        pendingReviewCount={s.pendingReview.length}
        nextWeekEmpty={d.weekEmpty}
        onFilterPendingReview={() => s.setFilters({ ...EMPTY_FILTERS, statuses: ["in_review"] })}
      />

      <CalendarDnd
        items={s.effectiveItems}
        tz={s.tz}
        onDrop={(item, dayKey) =>
          performDrop(item, dayKey, s.todayKey, s.tz, s.setOverride, t, locale, props.client.id)
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0" {...swipe}>
            {s.view === "month" ? (
              <MonthGrid
                days={s.monthDays}
                currentMonth={s.cursor.month}
                itemsByDay={s.itemsByDay}
                ctx={ctx}
              />
            ) : (
              <WeekView days={s.weekDays} itemsByDay={s.itemsByDay} ctx={ctx} />
            )}
          </div>
          <PlanningShelf shelfItems={s.shelfItems} evergreenItems={d.evergreenItems} ctx={ctx} />
        </div>
      </CalendarDnd>

      <DaySheet
        dayKey={sheetDay}
        items={sheetDay !== null ? (s.allByDay.get(sheetDay) ?? []) : []}
        ctx={ctx}
        onClose={() => setSheetDay(null)}
        onAddNote={(dayKey, title, kind) => {
          // Ajout optimiste local, puis persistance réelle (client_events).
          s.addNote(dayKey, title, kind)
          addClientEvent({ clientId: props.client.id, eventDate: dayKey, title, kind }).then(
            (res) => {
              if (res.ok) toast.success(t("calendar.daySheet.noteAdded", { kind }))
              else toast.error(t("calendar.daySheet.noteError"))
            }
          )
        }}
      />

      <CalendarSelectionActions
        active={s.selectionMode}
        selection={selection}
        selectedItems={selectedItems}
        todayKey={s.todayKey}
        tz={s.tz}
        clientId={props.client.id}
        setOverridesBatch={s.setOverridesBatch}
      />

      <RescheduleDialog
        item={rescheduleItem}
        tz={s.tz}
        todayKey={s.todayKey}
        onClose={() => setRescheduleItem(null)}
        onConfirm={(item, dayKey, time) => {
          performReschedule(item, dayKey, time, s.tz, s.setOverride, t, locale, props.client.id)
          setRescheduleItem(null)
        }}
      />
      <DuplicateDialog
        item={duplicateItem}
        clients={props.clients}
        currentClientId={props.client.id}
        tz={s.tz}
        todayKey={s.todayKey}
        onClose={() => setDuplicateItem(null)}
        onConfirm={(item, dayKey, targetClientId) => {
          const target = props.clients.find((c) => c.id === targetClientId)
          performDuplicate(
            item,
            dayKey,
            s.tz,
            targetClientId === props.client.id ? null : (target?.name ?? null),
            t,
            locale
          )
          setDuplicateItem(null)
        }}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        client={props.client}
        monthLabel={monthYearLabel(s.cursor, locale)}
        days={s.monthDays}
        currentMonth={s.cursor.month}
        itemsByDay={s.allByDay}
        tz={s.tz}
      />
      <AutomationDialog open={autoOpen} onClose={() => setAutoOpen(false)} />
    </div>
  )
}
