"use client"

import { Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"

// Mots interdits sous forme de tags — alimentent les garde-fous de légende du
// composer (lib/caption détecte ces termes en temps réel pendant la rédaction).

export function BannedWordsEditor({
  words,
  onChange,
}: {
  words: string[]
  onChange: (next: string[]) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState("")

  function add() {
    const value = draft.trim().toLowerCase()
    if (!value || words.includes(value)) {
      setDraft("")
      return
    }
    onChange([...words, value])
    setDraft("")
  }

  function remove(word: string) {
    onChange(words.filter((w) => w !== word))
  }

  return (
    <div className="space-y-2">
      {words.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {words.map((word) => (
            <li key={word}>
              <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {word}
                <button
                  type="button"
                  onClick={() => remove(word)}
                  aria-label={t("clientSettings.banned.removeAria", { value: word })}
                  className="rounded-full outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          {t("clientSettings.banned.empty")}
        </p>
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
          placeholder={t("clientSettings.banned.placeholder")}
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus />
          {t("clientSettings.banned.add")}
        </Button>
      </div>
    </div>
  )
}
