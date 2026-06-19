"use client"

import { Palette, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { BrandKit } from "@/lib/mocks/types"
import { BannedWordsEditor } from "./banned-words-editor"
import { arraysEqual, PaletteEditor } from "./palette-editor"
import { SaveBar, SectionCard } from "./section-card"
import { StringListEditor } from "./string-list-editor"

const EMPTY_KIT = {
  palette: [] as string[],
  tone: "",
  doList: [] as string[],
  dontList: [] as string[],
  bannedWords: [] as string[],
}

export function SectionBrandKit({
  clientId,
  brandKit,
}: {
  clientId: string
  brandKit: BrandKit | undefined
}) {
  const base = brandKit ?? { clientId, ...EMPTY_KIT }
  const [palette, setPalette] = useState(base.palette)
  const [tone, setTone] = useState(base.tone)
  const [doList, setDoList] = useState(base.doList)
  const [dontList, setDontList] = useState(base.dontList)
  const [bannedWords, setBannedWords] = useState(base.bannedWords)

  const dirty =
    !arraysEqual(palette, base.palette) ||
    tone !== base.tone ||
    !arraysEqual(doList, base.doList) ||
    !arraysEqual(dontList, base.dontList) ||
    !arraysEqual(bannedWords, base.bannedWords)

  function save() {
    toast.success("Identité de marque enregistrée (aperçu)", {
      description: "Le composer s'appuie sur ces règles pour guider la rédaction des légendes.",
    })
  }

  return (
    <SectionCard
      icon={Palette}
      title="Identité de marque"
      description="Palette, ton et règles éditoriales du client. Rappelés dans le studio pendant la rédaction."
    >
      <div className="space-y-2">
        <Label>Palette de couleurs</Label>
        <PaletteEditor palette={palette} onChange={setPalette} />
        <p className="text-xs text-muted-foreground">
          Clique une pastille pour copier sa valeur, la croix pour la retirer, « + » pour en ajouter
          une.
        </p>
      </div>

      <Separator />

      <div className="grid gap-1.5">
        <Label htmlFor="brand-tone">Ton de voix</Label>
        <Textarea
          id="brand-tone"
          rows={3}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Ex. : Chaleureux et artisanal — tutoiement, vocabulaire sensoriel, jamais de jargon."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-success">
            <ThumbsUp className="size-4" />À faire
          </Label>
          <StringListEditor
            items={doList}
            onChange={setDoList}
            placeholder="Ex. : Tutoyer la communauté"
            addLabel="Ajouter"
            emptyLabel="Aucune règle « à faire » pour l'instant."
          />
        </div>
        <div className="space-y-2">
          <Label className="text-destructive">
            <ThumbsDown className="size-4" />À éviter
          </Label>
          <StringListEditor
            items={dontList}
            onChange={setDontList}
            placeholder="Ex. : Promotions agressives"
            addLabel="Ajouter"
            emptyLabel="Aucune règle « à éviter » pour l'instant."
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>
          <ShieldAlert className="size-4 text-destructive" />
          Mots interdits
        </Label>
        <BannedWordsEditor words={bannedWords} onChange={setBannedWords} />
        <p className="text-xs text-muted-foreground">
          Ces termes alimentent les garde-fous de légende du composer : tout mot interdit y est
          surligné en temps réel pendant la rédaction.
        </p>
      </div>

      <SaveBar dirty={dirty} onSave={save} />
    </SectionCard>
  )
}
