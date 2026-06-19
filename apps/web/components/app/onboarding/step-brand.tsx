"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Ces repères suivront le client partout : ils s'afficheront pendant la rédaction et serviront
        de garde-fous. Vous pourrez les affiner à tout moment dans les réglages.
      </p>

      <BrandPaletteEditor palette={draft.palette} onChange={(palette) => patch({ palette })} />

      <div className="space-y-1.5">
        <Label htmlFor="brand-tone">Ton éditorial</Label>
        <Select value={draft.tone} onValueChange={(v) => patch({ tone: String(v) })}>
          <SelectTrigger id="brand-tone" className="w-full sm:w-72">
            <SelectValue placeholder="Choisir un ton" />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Comment la marque s'adresse à son audience (tutoiement, vouvoiement, registre…).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StringListEditor
          label="À faire"
          tone="do"
          placeholder="Ex. Tutoyer la communauté"
          values={draft.doList}
          onChange={(doList) => patch({ doList })}
        />
        <StringListEditor
          label="À éviter"
          tone="dont"
          placeholder="Ex. Promotions agressives"
          values={draft.dontList}
          onChange={(dontList) => patch({ dontList })}
        />
      </div>

      <TagInput
        label="Mots interdits"
        description="Termes à ne jamais utiliser (concurrents, claims, jargon). Ocean alertera s'ils apparaissent dans une légende."
        placeholder="Ex. discount, concurrent…"
        values={draft.bannedWords}
        onChange={(bannedWords) => patch({ bannedWords })}
      />
    </div>
  )
}
