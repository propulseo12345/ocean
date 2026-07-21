"use client"

import { CalendarClock, Info, Plus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  addRecurringSlot,
  deleteRecurringSlot,
  updateRecurringSlot,
} from "@/lib/actions/recurring-slots"
import type { Client, ContentPillar, RecurringSlot } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { SectionCard } from "./section-card"
import { SlotRow } from "./slot-row"
import { SlotsWeekPreview } from "./slots-week-preview"

let counter = 0

// Un créneau non encore persisté porte un id temporaire non-uuid : ses éditions
// ne déclenchent aucune écriture tant que l'insert n'a pas renvoyé son id réel.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isPersisted = (id: string) => UUID_RE.test(id)

export function SectionSlots({
  client,
  slots: initial,
  pillars,
}: {
  client: Client
  slots: RecurringSlot[]
  pillars: ContentPillar[]
}) {
  const t = useT()
  const [slots, setSlots] = useState<RecurringSlot[]>(initial)
  const [, startTransition] = useTransition()

  function patch(id: string, patch: Partial<RecurringSlot>) {
    let updated: RecurringSlot | undefined
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        updated = { ...s, ...patch }
        return updated
      })
    )
    if (!updated || !isPersisted(id)) return
    const next = updated
    startTransition(async () => {
      const res = await updateRecurringSlot({
        clientId: client.id,
        slotId: id,
        weekday: next.weekday,
        time: next.time,
        platforms: next.platforms,
        pillarId: next.pillarId ?? null,
      })
      if (!res.ok) toast.error(t("clientSettings.saveBar.error"))
    })
  }

  function remove(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id))
    if (!isPersisted(id)) {
      toast.info(t("clientSettings.slots.removedToast"))
      return
    }
    startTransition(async () => {
      const res = await deleteRecurringSlot({ clientId: client.id, slotId: id })
      if (res.ok) toast.info(t("clientSettings.slots.removedToast"))
      else toast.error(t("clientSettings.saveBar.error"))
    })
  }

  function add() {
    counter += 1
    const optimistic: RecurringSlot = {
      id: `slot_new_${counter}`,
      clientId: client.id,
      weekday: 2,
      time: "11:30",
      platforms: ["instagram"],
    }
    setSlots((prev) => [...prev, optimistic])
    startTransition(async () => {
      const res = await addRecurringSlot({
        clientId: client.id,
        weekday: optimistic.weekday,
        time: optimistic.time,
        platforms: optimistic.platforms,
        pillarId: null,
      })
      if (res.ok && res.data) {
        const realId = res.data.id
        setSlots((prev) => prev.map((s) => (s.id === optimistic.id ? { ...s, id: realId } : s)))
        toast.info(t("clientSettings.slots.addedToast"), {
          description: t("clientSettings.slots.addedToastDescription"),
        })
      } else {
        setSlots((prev) => prev.filter((s) => s.id !== optimistic.id))
        toast.error(t("clientSettings.saveBar.error"))
      }
    })
  }

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("clientSettings.slots.title")}
      description={t("clientSettings.slots.description")}
      action={
        <Button size="sm" variant="outline" onClick={add}>
          <Plus />
          {t("clientSettings.slots.add")}
        </Button>
      }
    >
      {slots.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("clientSettings.slots.empty")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("clientSettings.slots.colDay")}</TableHead>
              <TableHead>{t("clientSettings.slots.colTime")}</TableHead>
              <TableHead>{t("clientSettings.slots.colPlatforms")}</TableHead>
              <TableHead>{t("clientSettings.slots.colPillar")}</TableHead>
              <TableHead className="text-right">{t("clientSettings.slots.colRemove")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                pillars={pillars}
                onPatch={(p) => patch(slot.id, p)}
                onRemove={() => remove(slot.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("clientSettings.slots.note")}
      </p>

      {slots.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("clientSettings.slots.weekPreviewTitle")}
          </p>
          <SlotsWeekPreview slots={slots} pillars={pillars} />
        </div>
      ) : null}
    </SectionCard>
  )
}
