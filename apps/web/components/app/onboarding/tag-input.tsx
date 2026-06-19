"use client"

import { Plus, X } from "lucide-react"
import { useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"

// Saisie de tags (mots interdits, etc.) : ajout par Entrée ou virgule,
// suppression au clic. Dédoublonnage insensible à la casse.

export function TagInput({
  label,
  description,
  placeholder,
  values,
  onChange,
}: {
  label: string
  description?: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const t = useT()
  const id = useId()
  const [draft, setDraft] = useState("")

  function add() {
    const cleaned = draft.trim().replace(/,$/, "").trim()
    if (!cleaned) return
    if (values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...values, cleaned])
    setDraft("")
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          aria-label={t("onboarding.listEditor.add")}
        >
          <Plus />
        </Button>
      </div>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {values.map((value) => (
            <li key={value}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {value}
                <button
                  type="button"
                  onClick={() => remove(value)}
                  aria-label={t("onboarding.listEditor.removeAria", { value })}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
