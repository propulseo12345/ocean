"use client"

import { Plus, Sparkles, X } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  CATEGORIES,
  type DraftPillar,
  PILLAR_COLOR_VARS,
  PILLAR_SUGGESTIONS,
  pillarShareTotal,
} from "./wizard-types"

// Éditeur de piliers éditoriaux : ajout (nom + couleur de thème), part cible en
// %, jauge de mix qui vise idéalement 100 %. Suggestions selon la catégorie.

const MAX_PILLARS = 6
// Compteur stable (jamais Date.now() : déterministe et SSR-safe) pour les ids
// des piliers brouillon créés à la volée.
let counter = 0
function nextId() {
  counter += 1
  return `dpil_${counter}`
}

export function PillarEditor({
  pillars,
  category,
  onChange,
}: {
  pillars: DraftPillar[]
  category: string
  onChange: (pillars: DraftPillar[]) => void
}) {
  const t = useT()
  const id = useId()
  const [name, setName] = useState("")
  const total = pillarShareTotal(pillars)
  const categoryLabelKey = CATEGORIES.find((c) => c.value === category)?.labelKey
  // Les suggestions sont des clés i18n : on les résout en libellés avant de
  // dédoublonner contre les piliers déjà ajoutés (comparaison sur le texte affiché).
  const suggestions = (PILLAR_SUGGESTIONS[category] ?? PILLAR_SUGGESTIONS.default)
    .map((key) => t(key))
    .filter((label) => !pillars.some((p) => p.name.toLowerCase() === label.toLowerCase()))

  function add(pillarName: string) {
    const cleaned = pillarName.trim()
    if (!cleaned || pillars.length >= MAX_PILLARS) return
    if (pillars.some((p) => p.name.toLowerCase() === cleaned.toLowerCase())) return
    const share = pillars.length === 0 ? 30 : Math.max(0, Math.round((100 - total) / 1))
    onChange([
      ...pillars,
      {
        id: nextId(),
        name: cleaned,
        colorVar: PILLAR_COLOR_VARS[pillars.length % PILLAR_COLOR_VARS.length],
        targetShare: Math.min(share, 40),
      },
    ])
    setName("")
  }

  function update(pillarId: string, share: number) {
    onChange(
      pillars.map((p) =>
        p.id === pillarId ? { ...p, targetShare: Math.max(0, Math.min(100, share)) } : p
      )
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.length > 0 ? (
        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            {categoryLabelKey
              ? t("onboarding.pillar.suggestionsFor", { category: t(categoryLabelKey) })
              : t("onboarding.pillar.suggestions")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => add(s)}
                disabled={pillars.length >= MAX_PILLARS}
              >
                <Plus />
                {s}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {pillars.length > 0 ? (
        <ul className="space-y-2">
          {pillars.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: p.colorVar }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={p.targetShare}
                  onChange={(e) => update(p.id, Number(e.target.value))}
                  className="h-7 w-16 text-right tabular-nums"
                  aria-label={t("onboarding.pillar.sharePctAria", { name: p.name })}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                onClick={() => onChange(pillars.filter((x) => x.id !== p.id))}
                aria-label={t("onboarding.pillar.removeAria", { name: p.name })}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <Input
          id={id}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(name)
            }
          }}
          placeholder={t("onboarding.pillar.customPlaceholder")}
          disabled={pillars.length >= MAX_PILLARS}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => add(name)}
          disabled={pillars.length >= MAX_PILLARS}
        >
          <Plus />
          {t("onboarding.pillar.add")}
        </Button>
      </div>

      {pillars.length > 0 ? <MixGauge pillars={pillars} total={total} /> : null}
    </div>
  )
}

function MixGauge({ pillars, total }: { pillars: DraftPillar[]; total: number }) {
  const t = useT()
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {pillars.map((p) => (
          <span
            key={p.id}
            style={{ backgroundColor: p.colorVar, width: `${Math.min(p.targetShare, 100)}%` }}
            aria-hidden
          />
        ))}
      </div>
      <p
        className={cn(
          "text-xs tabular-nums",
          total === 100 ? "text-success" : "text-muted-foreground"
        )}
      >
        {total === 100
          ? t("onboarding.pillar.totalBalanced", { total })
          : t("onboarding.pillar.totalHint", { total })}
      </p>
    </div>
  )
}
