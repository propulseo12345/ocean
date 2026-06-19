"use client"

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { CalendarView } from "./calendar-types"
import type { CalendarCursor } from "./calendar-utils"

// Barre de navigation : période, aujourd'hui, sélecteur mois/année rapide,
// bascule Mois/Semaine (raccourcis : ←/→ période, T aujourd'hui, M/S vue).

const MONTH_LABELS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Période précédente" onClick={onPrev}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Période suivante" onClick={onNext}>
            <ChevronRight />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onToday} title="Raccourci : T">
          Aujourd'hui
        </Button>
        <div className="min-w-0">
          <MonthYearPicker cursor={cursor} periodLabel={periodLabel} onMonth={onMonth} />
          <p className="truncate text-xs text-muted-foreground">Fuseau du client · {timezone}</p>
        </div>
      </div>

      <ViewSwitch view={view} onView={onView} />
    </div>
  )
}

function MonthYearPicker({
  cursor,
  periodLabel,
  onMonth,
}: {
  cursor: CalendarCursor
  periodLabel: string
  onMonth: (year: number, month: number) => void
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
            aria-label="Aller à un mois précis"
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
            aria-label="Année précédente"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Année suivante"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, month) => (
            <Button
              key={label}
              variant={year === cursor.year && month === cursor.month ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                onMonth(year, month)
                setOpen(false)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewSwitch({ view, onView }: { view: CalendarView; onView: (v: CalendarView) => void }) {
  const options: { value: CalendarView; label: string }[] = [
    { value: "month", label: "Mois" },
    { value: "week", label: "Semaine" },
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
