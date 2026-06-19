"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n"
import { BrandPaletteEditor } from "./brand-color-palette"
import { StringListEditor } from "./string-list-editor"
import { TagInput } from "./tag-input"
import { type ClientDraft, TONES } from "./wizard-types"

// Étape 3 — identité de marque (brand kit light) : palette, ton éditorial,
// règles « à faire » / « à éviter », mots interdits. Tout optionnel mais
// encouragé (réduit les retours de validation « ce n'est pas notre ton »).

export function StepBrand({
  draft,
  patch,
}: {
  draft: ClientDraft
  patch: (partial: Partial<ClientDraft>) => void
}) {
  const t = useT()
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("onboarding.brand.intro")}</p>

      <BrandPaletteEditor palette={draft.palette} onChange={(palette) => patch({ palette })} />

      <div className="space-y-1.5">
        <Label htmlFor="brand-tone">{t("onboarding.brand.toneLabel")}</Label>
        <Select value={draft.tone} onValueChange={(v) => patch({ tone: String(v) })}>
          <SelectTrigger id="brand-tone" className="w-full sm:w-72">
            <SelectValue placeholder={t("onboarding.brand.tonePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((toneKey) => (
              <SelectItem key={toneKey} value={toneKey}>
                {t(toneKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("onboarding.brand.toneHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StringListEditor
          label={t("onboarding.brand.doLabel")}
          tone="do"
          placeholder={t("onboarding.brand.doPlaceholder")}
          values={draft.doList}
          onChange={(doList) => patch({ doList })}
        />
        <StringListEditor
          label={t("onboarding.brand.dontLabel")}
          tone="dont"
          placeholder={t("onboarding.brand.dontPlaceholder")}
          values={draft.dontList}
          onChange={(dontList) => patch({ dontList })}
        />
      </div>

      <TagInput
        label={t("onboarding.brand.bannedLabel")}
        description={t("onboarding.brand.bannedDescription")}
        placeholder={t("onboarding.brand.bannedPlaceholder")}
        values={draft.bannedWords}
        onChange={(bannedWords) => patch({ bannedWords })}
      />
    </div>
  )
}
