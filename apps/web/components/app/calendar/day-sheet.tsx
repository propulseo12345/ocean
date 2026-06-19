"use client"

import { Flag, Plus, StickyNote } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { type MessageKey, pick, useLocale, useT } from "@/lib/i18n"
import { getMarronniersOn, type MarronnierKind } from "@/lib/marronniers"
import type { ClientEvent, ContentItem } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { createContentHref } from "./calendar-schedule"
import type { DayContext } from "./calendar-types"
import { type DayKey, weekdayDayMonth } from "./calendar-utils"
import { DaySheetRow } from "./day-sheet-row"

// Clé i18n du libellé d'un type de marronnier.
const MARRONNIER_KIND_KEY: Record<MarronnierKind, MessageKey> = {
  ferie: "marronnier.kind.ferie",
  fete: "marronnier.kind.fete",
  soldes: "marronnier.kind.soldes",
  marketing: "marronnier.kind.marketing",
}

// Panneau Jour : TOUS les contenus d'une date + notes, événements et
// marronniers, sans quitter le calendrier. Bottom sheet sur mobile.

export function DaySheet({
  dayKey,
  items,
  ctx,
  onClose,
  onAddNote,
}: {
  dayKey: DayKey | null
  items: ContentItem[]
  ctx: DayContext
  onClose: () => void
  onAddNote: (dayKey: DayKey, title: string, kind: ClientEvent["kind"]) => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const isMobile = useIsMobile()
  const [noteDraft, setNoteDraft] = useState("")
  const [noteKind, setNoteKind] = useState<ClientEvent["kind"]>("note")

  if (dayKey === null) return null
  const events = ctx.eventsByDay.get(dayKey) ?? []
  const marronniers = getMarronniersOn(dayKey)
  const isPast = dayKey < ctx.todayKey

  function submitNote() {
    const title = noteDraft.trim()
    if (title.length === 0 || dayKey === null) return
    onAddNote(dayKey, title, noteKind)
    setNoteDraft("")
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(isMobile ? "max-h-[85dvh]" : "sm:max-w-md", "overflow-y-auto")}
      >
        <SheetHeader>
          <SheetTitle className="capitalize">{weekdayDayMonth(dayKey, ctx.tz)}</SheetTitle>
          <SheetDescription>
            {t("calendar.daySheet.itemsCount", { count: items.length })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {marronniers.length > 0 ? (
            <ul className="space-y-1">
              {marronniers.map((m) => {
                const label = pick(m.label, locale)
                return (
                  <li
                    key={`${m.date}_${label}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-secondary px-2 py-1.5 text-xs text-secondary-foreground"
                  >
                    <span className="min-w-0 truncate">
                      {label}
                      <span className="text-secondary-foreground/70">
                        {t("calendar.daySheet.marronnierKind", {
                          kind: t(MARRONNIER_KIND_KEY[m.kind]),
                        })}
                      </span>
                    </span>
                    {!isPast ? (
                      <Link
                        href={createContentHref(ctx.clientId, dayKey, ctx.tz)}
                        className="shrink-0 font-medium text-primary hover:underline"
                      >
                        {t("calendar.daySheet.createContent")}
                      </Link>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {t("calendar.daySheet.noContent")}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <DaySheetRow key={item.id} item={item} ctx={ctx} />
              ))}
            </ul>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
              {t("calendar.daySheet.notesEvents")}
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">{t("calendar.daySheet.noNote")}</p>
            ) : (
              <ul className="space-y-1">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    {ev.kind === "note" ? (
                      <StickyNote
                        className="size-3.5 shrink-0"
                        aria-label={t("calendar.daySheet.note")}
                      />
                    ) : (
                      <Flag
                        className="size-3.5 shrink-0"
                        aria-label={t("calendar.daySheet.event")}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{pick(ev.title, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNote()}
                placeholder={t("calendar.daySheet.addNotePlaceholder")}
                aria-label={t("calendar.daySheet.noteTextLabel")}
                className="h-8 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteKind((k) => (k === "note" ? "event" : "note"))}
                aria-label={t("calendar.daySheet.typeToggle", { kind: noteKind })}
                title={t("calendar.daySheet.typeToggleTitle")}
              >
                {noteKind === "note" ? <StickyNote /> : <Flag />}
              </Button>
              <Button size="sm" onClick={submitNote} disabled={noteDraft.trim().length === 0}>
                {t("calendar.daySheet.add")}
              </Button>
            </div>
          </section>

          {!isPast ? (
            <Button
              className="w-full"
              variant="outline"
              render={<Link href={createContentHref(ctx.clientId, dayKey, ctx.tz)} />}
            >
              <Plus data-icon="inline-start" />
              {t("calendar.daySheet.createPrefilled")}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
