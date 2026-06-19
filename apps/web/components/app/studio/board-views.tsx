"use client"

import { BookmarkPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const noFilters = filtersAreEmpty(board.filters)

  function save() {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    board.saveCurrentView(trimmed, clientId)
    setOpen(false)
    setName("")
    toast.success(`Vue « ${trimmed} » enregistrée (aperçu)`, {
      description: "Disponible dans les chips de vues — état local de la preview.",
    })
  }

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
      <ViewChip
        label="Tous les contenus"
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
              title={noFilters ? "Applique d'abord des filtres ou une recherche" : undefined}
            />
          }
        >
          <BookmarkPlus />
          Enregistrer la vue actuelle
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="space-y-1.5">
            <Label htmlFor="board-view-name">Nom de la vue</Label>
            <Input
              id="board-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Ex. Reels en attente"
              autoFocus
            />
          </div>
          <Button size="sm" onClick={save} disabled={name.trim().length === 0}>
            Enregistrer (aperçu)
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
