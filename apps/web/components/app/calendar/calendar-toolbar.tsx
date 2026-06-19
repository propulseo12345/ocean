"use client"

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type MessageKey, type Translator, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { CalendarView } from "./calendar-types"
import type { CalendarCursor } from "./calendar-utils"

// Barre de navigation : période, aujourd'hui, sélecteur mois/année rapide,
// bascule Mois/Semaine (raccourcis : ←/→ période, T aujourd'hui, M/S vue).

const MONTH_LABEL_KEYS: MessageKey[] = [
  "calendar.toolbar.months.jan",
  "calendar.toolbar.months.feb",
  "calendar.toolbar.months.mar",
  "calendar.toolbar.months.apr",
  "calendar.toolbar.months.may",
  "calendar.toolbar.months.jun",
  "calendar.toolbar.months.jul",
  "calendar.toolbar.months.aug",
  "calendar.toolbar.months.sep",
  "calendar.toolbar.months.oct",
  "calendar.toolbar.months.nov",
  "calendar.toolbar.months.dec",
]

export function CalendarToolbar({
  periodLabel,
  timezone,
  view,
  cursor,
  onView,
  onPrev,
  onNext,
  onToday,
  onMonth,
}: {
  periodLabel: string
  timezone: string
  view: CalendarView
  cursor: CalendarCursor
  onView: (v: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onMonth: (year: number, month: number) => void
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.toolbar.prevPeriod")}
            onClick={onPrev}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("calendar.toolbar.nextPeriod")}
            onClick={onNext}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          title={t("calendar.toolbar.todayShortcut")}
        >
          {t("calendar.toolbar.today")}
        </Button>
        <div className="min-w-0">
          <MonthYearPicker cursor={cursor} periodLabel={periodLabel} onMonth={onMonth} t={t} />
          <p className="truncate text-xs text-muted-foreground">
            {t("calendar.toolbar.clientTimezone", { tz: timezone })}
          </p>
        </div>
      </div>

      <ViewSwitch view={view} onView={onView} t={t} />
    </div>
  )
}

function MonthYearPicker({
  cursor,
  periodLabel,
  onMonth,
  t,
}: {
  cursor: CalendarCursor
  periodLabel: string
  onMonth: (year: number, month: number) => void
  t: Translator
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(cursor.year)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setYear(cursor.year)
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("calendar.toolbar.goToMonth")}
            className="flex max-w-full items-center gap-1 truncate rounded-md font-heading text-base leading-tight font-semibold capitalize transition-colors hover:text-primary"
          />
        }
      >
        {periodLabel}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("calendar.toolbar.prevYear")}
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("calendar.toolbar.nextYear")}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABEL_KEYS.map((labelKey, month) => (
            <Button
              key={labelKey}
              variant={year === cursor.year && month === cursor.month ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                onMonth(year, month)
                setOpen(false)
              }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewSwitch({
  view,
  onView,
  t,
}: {
  view: CalendarView
  onView: (v: CalendarView) => void
  t: Translator
}) {
  const options: { value: CalendarView; label: string }[] = [
    { value: "month", label: t("calendar.toolbar.viewMonth") },
    { value: "week", label: t("calendar.toolbar.viewWeek") },
  ]
  return (
    <div className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={view === o.value}
          onClick={() => onView(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            view === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
