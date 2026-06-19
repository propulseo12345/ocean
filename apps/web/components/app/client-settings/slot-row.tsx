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
import { API_PLATFORMS, platformMeta } from "@/lib/mocks/labels"
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
                {WEEKDAY_LABELS[d].long}
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
          aria-label="Heure du créneau"
        />
      </TableCell>

      <TableCell>
        <div className="flex gap-1">
          {API_PLATFORMS.map((platform) => {
            const active = slot.platforms.includes(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={active}
                aria-label={platformMeta[platform].label}
                title={platformMeta[platform].label}
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
            <SelectItem value={NO_PILLAR}>Aucun pilier</SelectItem>
            {pillars.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="text-right">
        <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Supprimer ce créneau">
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
