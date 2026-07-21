"use client"

import { Trash2 } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import { useLabels, useT } from "@/lib/i18n"
import { API_PLATFORMS } from "@/lib/mocks/labels"
import type { ContentPillar, Platform, RecurringSlot } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "./constants"

const NO_PILLAR = "__none__"

export function SlotRow({
  slot,
  pillars,
  onPatch,
  onRemove,
}: {
  slot: RecurringSlot
  pillars: ContentPillar[]
  onPatch: (patch: Partial<RecurringSlot>) => void
  onRemove: () => void
}) {
  const t = useT()
  const lbl = useLabels()

  function togglePlatform(platform: Platform) {
    const next = slot.platforms.includes(platform)
      ? slot.platforms.filter((p) => p !== platform)
      : [...slot.platforms, platform]
    if (next.length > 0) onPatch({ platforms: next })
  }

  return (
    <TableRow>
      <TableCell>
        <Select value={String(slot.weekday)} onValueChange={(v) => onPatch({ weekday: Number(v) })}>
          <SelectTrigger size="sm" className="w-full min-w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAY_ORDER.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {t(WEEKDAY_LABELS[d].longKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Input
          type="time"
          value={slot.time}
          onChange={(e) => onPatch({ time: e.target.value })}
          className="w-26 tabular-nums"
          aria-label={t("clientSettings.slots.timeAriaLabel")}
        />
      </TableCell>

      <TableCell>
        <div className="flex gap-1">
          {API_PLATFORMS.map((platform) => {
            const active = slot.platforms.includes(platform)
            const platformLabel = lbl.platform(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={active}
                aria-label={platformLabel}
                title={platformLabel}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-input opacity-40 hover:opacity-100"
                )}
              >
                <PlatformIcon platform={platform} className="size-4" />
              </button>
            )
          })}
        </div>
      </TableCell>

      <TableCell>
        <Select
          value={slot.pillarId ?? NO_PILLAR}
          onValueChange={(v) => onPatch({ pillarId: v === NO_PILLAR ? undefined : String(v) })}
        >
          <SelectTrigger size="sm" className="w-full min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PILLAR}>{t("clientSettings.slots.noPillar")}</SelectItem>
            {pillars.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="text-right">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={t("clientSettings.slots.removeSlot")}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
