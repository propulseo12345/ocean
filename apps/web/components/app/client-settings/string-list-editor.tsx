"use client"

import { Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"

// Éditeur de lignes de texte (listes « À faire » / « À éviter » du brand kit).

export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
  emptyLabel: string
}) {
  const t = useT()
  const [draft, setDraft] = useState("")

  function add() {
    const value = draft.trim()
    if (!value) return
    onChange([...items, value])
    setDraft("")
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1">{item}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={t("clientSettings.stringList.removeAria", { value: item })}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus />
          {addLabel}
        </Button>
      </div>
    </div>
  )
}
