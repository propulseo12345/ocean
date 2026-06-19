"use client"

import { Tag, X } from "lucide-react"
import { useState } from "react"
import { FormatIcon } from "@/components/shared/format-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { pick, useLabels, useLocale, useT } from "@/lib/i18n"
import type { ContentFormat, ContentPillar } from "@/lib/mocks/types"
import type { ComposerDraft, DraftState } from "./composer-types"

const FORMATS: ContentFormat[] = ["post", "carousel", "reel", "story"]
const NO_PILLAR = "none"

// Section « Contenu » : titre, format, état, pilier, étiquettes, notes internes.

export function ComposerBasics({
  draft,
  pillars,
  onPatch,
  onFormatChange,
}: {
  draft: ComposerDraft
  pillars: ContentPillar[]
  onPatch: (partial: Partial<ComposerDraft>) => void
  onFormatChange: (format: ContentFormat) => void
}) {
  const t = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  const [labelInput, setLabelInput] = useState("")

  function addLabel() {
    const value = labelInput.trim()
    if (value.length === 0) return
    if (!draft.labels.includes(value)) onPatch({ labels: [...draft.labels, value] })
    setLabelInput("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("composer.basics.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="composer-title">{t("composer.basics.internalTitle")}</Label>
          <Input
            id="composer-title"
            value={draft.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder={t("composer.basics.internalTitlePlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="space-y-1.5">
            <Label>{t("composer.basics.format")}</Label>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <ToggleGroup
                value={[draft.format]}
                onValueChange={(v) => {
                  const next = v[0] as ContentFormat | undefined
                  if (next) onFormatChange(next)
                }}
                variant="outline"
                size="sm"
              >
                {FORMATS.map((f) => (
                  <ToggleGroupItem key={f} value={f} className="gap-1.5">
                    <FormatIcon format={f} className="size-3.5" />
                    {lbl.format(f)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("composer.basics.state")}</Label>
            <ToggleGroup
              value={[draft.state]}
              onValueChange={(v) => {
                const next = v[0] as DraftState | undefined
                if (next) onPatch({ state: next })
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="idea">{t("composer.basics.stateIdea")}</ToggleGroupItem>
              <ToggleGroupItem value="draft">{t("composer.basics.stateDraft")}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("composer.basics.pillar")}</Label>
          <Select
            value={draft.pillarId ?? NO_PILLAR}
            onValueChange={(value) =>
              onPatch({ pillarId: value === NO_PILLAR ? null : String(value) })
            }
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PILLAR}>{t("composer.basics.noPillar")}</SelectItem>
              {pillars.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.colorVar }}
                    aria-hidden
                  />
                  {pick(p.name, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="composer-labels">{t("composer.basics.labels")}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.labels.map((label) => (
              <Badge key={label} variant="secondary" className="gap-1 pr-1">
                <Tag className="size-3" />
                {label}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 rounded-sm"
                  aria-label={t("composer.basics.removeLabel", { label })}
                  onClick={() => onPatch({ labels: draft.labels.filter((l) => l !== label) })}
                >
                  <X />
                </Button>
              </Badge>
            ))}
            <Input
              id="composer-labels"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addLabel()
                }
              }}
              onBlur={addLabel}
              placeholder={t("composer.basics.addLabelPlaceholder")}
              className="h-7 w-36 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="composer-notes">{t("composer.basics.internalNotes")}</Label>
          <Textarea
            id="composer-notes"
            value={draft.internalNotes}
            onChange={(e) => onPatch({ internalNotes: e.target.value })}
            placeholder={t("composer.basics.internalNotesPlaceholder")}
            className="min-h-20"
          />
        </div>
      </CardContent>
    </Card>
  )
}
