"use client"

import { Printer } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { formatTime } from "@/lib/format"
import { type MessageKey, pick, useLabels, useLocale, useT } from "@/lib/i18n"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { type DayKey, dayNumber, monthOf } from "./calendar-utils"

// Entêtes de jours (lundi → dimanche) traduits via le namespace calendar.
const WEEKDAY_KEYS: MessageKey[] = [
  "calendar.weekdays.mon",
  "calendar.weekdays.tue",
  "calendar.weekdays.wed",
  "calendar.weekdays.thu",
  "calendar.weekdays.fri",
  "calendar.weekdays.sat",
  "calendar.weekdays.sun",
]

// Export PDF du planning : aperçu print stylé + window.print() (CSS @media
// print). Par défaut, les états techniques sont masqués (livrable client).

const TECHNICAL_STATUSES: ContentItem["status"][] = ["failed", "canceled", "partially_published"]

// Le dialog est transformé (translate) : on neutralise position/transform à
// l'impression, sinon le bloc fixed se positionnerait par rapport au dialog.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #calendar-print, #calendar-print * { visibility: visible; }
  [data-slot="dialog-content"] {
    position: static !important;
    transform: none !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
  }
  #calendar-print {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    overflow: visible;
    padding: 1.5rem;
    background: var(--background);
  }
}
`

export function ExportDialog({
  open,
  onClose,
  client,
  monthLabel,
  days,
  currentMonth,
  itemsByDay,
  tz,
}: {
  open: boolean
  onClose: () => void
  client: Client
  monthLabel: string
  days: DayKey[]
  currentMonth: number
  itemsByDay: ReadonlyMap<DayKey, ContentItem[]>
  tz: string
}) {
  const t = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  const [clientFriendly, setClientFriendly] = useState(true)

  function itemsFor(key: DayKey): ContentItem[] {
    const items = itemsByDay.get(key) ?? []
    return clientFriendly ? items.filter((it) => !TECHNICAL_STATUSES.includes(it.status)) : items
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <style>{PRINT_CSS}</style>
        <DialogHeader>
          <DialogTitle>{t("calendar.export.title")}</DialogTitle>
          <DialogDescription>{t("calendar.export.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex w-fit items-center gap-2 text-sm">
          <Switch
            checked={clientFriendly}
            onCheckedChange={setClientFriendly}
            aria-label={t("calendar.export.hideTechnical")}
          />
          {t("calendar.export.clientDeliverable")}
        </div>

        <div id="calendar-print" className="rounded-xl border bg-card p-4">
          <header className="mb-3 flex items-baseline justify-between gap-3 border-b pb-3">
            <div className="min-w-0">
              <p className="truncate font-heading text-lg font-semibold">{client.name}</p>
              <p className="truncate text-xs text-muted-foreground">@{client.handle}</p>
            </div>
            <p className="shrink-0 font-heading text-base font-medium capitalize">{monthLabel}</p>
          </header>

          <div className="grid grid-cols-7 overflow-hidden rounded-lg border-r border-b text-[10px]">
            {WEEKDAY_KEYS.map((labelKey) => (
              <div
                key={labelKey}
                className="border-t border-l bg-muted/40 px-1 py-1 text-center font-semibold text-muted-foreground uppercase"
              >
                {t(labelKey)}
              </div>
            ))}
            {days.map((key) => {
              const outside = monthOf(key) !== currentMonth
              const items = outside ? [] : itemsFor(key)
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-16 space-y-0.5 border-t border-l p-1",
                    outside && "bg-muted/30"
                  )}
                >
                  <p
                    className={cn(
                      "font-medium tabular-nums",
                      outside ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}
                  >
                    {dayNumber(key)}
                  </p>
                  {items.map((item) => (
                    <p key={item.id} className="leading-tight break-words">
                      <span className="text-muted-foreground tabular-nums">
                        {item.scheduledAt ? formatTime(item.scheduledAt, tz) : ""}
                      </span>{" "}
                      <span className="font-medium">{pick(item.title, locale)}</span>
                      {!clientFriendly ? (
                        <span className="text-muted-foreground"> · {lbl.contentStatus(item.status)}</span>
                      ) : null}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-right text-[10px] text-muted-foreground">
            {t("calendar.export.footer", { tz: client.timezone })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            {t("calendar.export.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
