"use client"

import { Hash } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { HashtagGroup } from "@/lib/mocks/types"

// Popover « Groupes de hashtags » du client : insertion d'un groupe en un clic
// dans la légende ou le premier commentaire (destination portée par le parent).

export function HashtagPopover({
  groups,
  onInsert,
  destinationLabel,
}: {
  groups: HashtagGroup[]
  onInsert: (tags: string[]) => void
  /** Ex. « la légende » / « le premier commentaire ». */
  destinationLabel: string
}) {
  const [open, setOpen] = useState(false)

  if (groups.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="xs" />}>
        <Hash />
        Groupes de hashtags
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Groupes du client</PopoverTitle>
          <p className="text-xs text-muted-foreground">
            Un clic insère le groupe dans {destinationLabel}.
          </p>
        </PopoverHeader>
        <ul className="space-y-1">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => {
                  onInsert(group.tags)
                  setOpen(false)
                }}
                className="w-full rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {group.name}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {group.tags.length} tag{group.tags.length > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                  {group.tags.join(" ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
