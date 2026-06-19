"use client"

import { Plus, X } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Liste éditable de règles courtes (« à faire » / « à éviter » du brand kit).
// Une règle par ligne, ajoutée par Entrée ou par le bouton.

export function StringListEditor({
  label,
  placeholder,
  values,
  onChange,
  tone = "neutral",
  maxItems = 6,
}: {
  label: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
  tone?: "do" | "dont" | "neutral"
  maxItems?: number
}) {
  const id = useId()
  const [draft, setDraft] = useState("")
  const atMax = values.length >= maxItems

  function add() {
    const cleaned = draft.trim()
    if (!cleaned || atMax) return
    if (values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...values, cleaned])
    setDraft("")
  }

  const dotClass =
    tone === "do" ? "bg-success" : tone === "dont" ? "bg-destructive" : "bg-muted-foreground/50"

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          disabled={atMax}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          disabled={atMax}
          aria-label="Ajouter"
        >
          <Plus />
        </Button>
      </div>
      {values.length > 0 ? (
        <ul className="space-y-1 pt-0.5">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
              <span className="min-w-0 flex-1 break-words">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Retirer ${value}`}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
