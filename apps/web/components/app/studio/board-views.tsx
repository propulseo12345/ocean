"use client"

import { BookmarkPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import type { SavedView } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import type { BoardState } from "./board-state"
import { filtersAreEmpty } from "./board-utils"

// Vues filtrées enregistrées : chips prêtes à l'emploi (« À traiter »,
// « En attente client »…) + enregistrement de la vue courante (état local).

function ViewChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

export function BoardViews({ board, clientId }: { board: BoardState; clientId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const noFilters = filtersAreEmpty(board.filters)

  function save() {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    board.saveCurrentView(trimmed, clientId)
    setOpen(false)
    setName("")
    toast.success(t("studio.views.saved", { name: trimmed }), {
      description: t("studio.views.savedDesc"),
    })
  }

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
      <ViewChip
        label={t("studio.views.all")}
        active={board.activeViewId === null && noFilters}
        onClick={() => board.applyView(null)}
      />
      {board.views.map((view: SavedView) => (
        <ViewChip
          key={view.id}
          label={view.name}
          active={board.activeViewId === view.id}
          onClick={() => board.applyView(view)}
        />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 rounded-full text-muted-foreground"
              disabled={noFilters}
              title={noFilters ? t("studio.views.saveDisabledHint") : undefined}
            />
          }
        >
          <BookmarkPlus />
          {t("studio.views.saveCurrent")}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="space-y-1.5">
            <Label htmlFor="board-view-name">{t("studio.views.nameLabel")}</Label>
            <Input
              id="board-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder={t("studio.views.namePlaceholder")}
              autoFocus
            />
          </div>
          <Button size="sm" onClick={save} disabled={name.trim().length === 0}>
            {t("studio.views.save")}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
