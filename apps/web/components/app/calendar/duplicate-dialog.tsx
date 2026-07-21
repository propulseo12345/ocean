"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Client, ContentItem } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { type DayKey, dayKeyOf, shiftWeek } from "./calendar-utils"

// Dupliquer un contenu vers une date, pour ce client ou un autre. La copie
// repart en brouillon avec son propre circuit de validation (aperçu).

export function DuplicateDialog({
  item,
  clients,
  currentClientId,
  tz,
  todayKey,
  onClose,
  onConfirm,
}: {
  item: ContentItem | null
  clients: Client[]
  currentClientId: string
  tz: string
  todayKey: DayKey
  onClose: () => void
  onConfirm: (item: ContentItem, dayKey: DayKey, targetClientId: string) => void
}) {
  const t = useT()
  const [dayKey, setDayKey] = useState<DayKey>(todayKey)
  const [clientId, setClientId] = useState(currentClientId)

  useEffect(() => {
    if (!item) return
    const base = item.scheduledAt
      ? shiftWeek(dayKeyOf(item.scheduledAt, tz), 7)
      : shiftWeek(todayKey, 1)
    setDayKey(base < todayKey ? shiftWeek(todayKey, 1) : base)
    setClientId(currentClientId)
  }, [item, tz, todayKey, currentClientId])

  const invalid = dayKey < todayKey

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("calendar.duplicate.title")}</DialogTitle>
          <DialogDescription className="truncate">{item ? item.title : null}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-date">{t("calendar.duplicate.targetDate")}</Label>
            <Input
              id="duplicate-date"
              type="date"
              min={todayKey}
              value={dayKey}
              onChange={(e) => setDayKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-client">{t("calendar.duplicate.targetClient")}</Label>
            <Select value={clientId} onValueChange={(value) => setClientId(String(value))}>
              <SelectTrigger id="duplicate-client" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.id === currentClientId ? t("calendar.duplicate.thisClient") : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{t("calendar.duplicate.copyHint")}</p>
          {invalid ? (
            <p className="text-xs text-destructive">{t("calendar.duplicate.pastDate")}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={invalid || !item}
            onClick={() => item && onConfirm(item, dayKey, clientId)}
          >
            {t("calendar.duplicate.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
