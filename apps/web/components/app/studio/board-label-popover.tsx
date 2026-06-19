"use client"

import { Plus, Tag } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { labelColorVar } from "./board-types"

// Éditeur d'étiquettes transverses (état local) : liste cochable + création
// libre. Utilisé en popover sur les cartes et dans l'action de lot.

export function LabelEditor({
  allLabels,
  initial,
  applyLabel,
  onApply,
}: {
  allLabels: string[]
  initial: string[]
  applyLabel: string
  onApply: (labels: string[]) => void
}) {
  const [checked, setChecked] = useState<string[]>(initial)
  const [extra, setExtra] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  const options = [...new Set([...allLabels, ...extra])].sort((a, b) => a.localeCompare(b, "fr"))

  function toggle(label: string) {
    setChecked((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  function addDraft() {
    const name = draft.trim()
    if (name.length === 0) return
    if (!options.includes(name)) setExtra((prev) => [...prev, name])
    if (!checked.includes(name)) setChecked((prev) => [...prev, name])
    setDraft("")
  }

  return (
    <div className="space-y-2.5">
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {options.map((label) => (
          <Label
            key={label}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm font-normal hover:bg-muted/60"
          >
            <Checkbox checked={checked.includes(label)} onCheckedChange={() => toggle(label)} />
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: labelColorVar(label) }}
            />
            {label}
          </Label>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDraft()}
          placeholder="Nouvelle étiquette…"
          aria-label="Nouvelle étiquette"
          className="h-7 text-xs"
        />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Ajouter l'étiquette"
          onClick={addDraft}
          disabled={draft.trim().length === 0}
        >
          <Plus />
        </Button>
      </div>
      <Button size="sm" className="w-full" onClick={() => onApply(checked)}>
        {applyLabel}
      </Button>
    </div>
  )
}

/** Édition rapide des étiquettes d'une carte (le clic ne navigue pas). */
export function CardLabelPopover({
  title,
  labels,
  allLabels,
  onApply,
}: {
  title: string
  labels: string[]
  allLabels: string[]
  onApply: (labels: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <span
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Étiquettes de « ${title} »`}
              className="text-muted-foreground"
            />
          }
        >
          <Tag />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60">
          <p className="text-sm font-medium">Étiquettes</p>
          <LabelEditor
            key={open ? "open" : "closed"}
            allLabels={allLabels}
            initial={labels}
            applyLabel="Appliquer (aperçu)"
            onApply={(next) => {
              onApply(next)
              setOpen(false)
              toast.success("Étiquettes mises à jour (aperçu)", {
                description: next.length > 0 ? next.join(" · ") : "Aucune étiquette.",
              })
            }}
          />
        </PopoverContent>
      </Popover>
    </span>
  )
}
