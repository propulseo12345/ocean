"use client"

import { Palette, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { updateBrandKit } from "@/lib/actions/brand-kit"
import { useT } from "@/lib/i18n"
import type { BrandKit } from "@/lib/mocks/types"
import { BannedWordsEditor } from "./banned-words-editor"
import { arraysEqual, PaletteEditor } from "./palette-editor"
import { SaveBar, SectionCard } from "./section-card"
import { StringListEditor } from "./string-list-editor"

interface ResolvedKit {
  palette: string[]
  tone: string
  doList: string[]
  dontList: string[]
  bannedWords: string[]
}

export function SectionBrandKit({
  clientId,
  brandKit,
}: {
  clientId: string
  brandKit: BrandKit | undefined
}) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const resolveList = (list: string[] | undefined) =>
    (list ?? [])

  const base: ResolvedKit = {
    palette: brandKit?.palette ?? [],
    tone: brandKit ? brandKit.tone : "",
    doList: resolveList(brandKit?.doList),
    dontList: resolveList(brandKit?.dontList),
    bannedWords: brandKit?.bannedWords ?? [],
  }

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
    startTransition(async () => {
      const res = await updateBrandKit({
        clientId,
        palette,
        tone,
        doList,
        dontList,
        bannedWords,
      })
      if (res.ok) {
        toast.success(t("clientSettings.brandKit.savedToast"), {
          description: t("clientSettings.brandKit.savedToastDescription"),
        })
      } else {
        toast.error(t("clientSettings.saveBar.error"))
      }
    })
  }

  return (
    <SectionCard
      icon={Palette}
      title={t("clientSettings.brandKit.title")}
      description={t("clientSettings.brandKit.description")}
    >
      <div className="space-y-2">
        <Label>{t("clientSettings.brandKit.paletteLabel")}</Label>
        <PaletteEditor palette={palette} onChange={setPalette} />
        <p className="text-xs text-muted-foreground">{t("clientSettings.brandKit.paletteHint")}</p>
      </div>

      <Separator />

      <div className="grid gap-1.5">
        <Label htmlFor="brand-tone">{t("clientSettings.brandKit.toneLabel")}</Label>
        <Textarea
          id="brand-tone"
          rows={3}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder={t("clientSettings.brandKit.tonePlaceholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-success">
            <ThumbsUp className="size-4" />
            {t("clientSettings.brandKit.doLabel")}
          </Label>
          <StringListEditor
            items={doList}
            onChange={setDoList}
            placeholder={t("clientSettings.brandKit.doPlaceholder")}
            addLabel={t("clientSettings.brandKit.addLabel")}
            emptyLabel={t("clientSettings.brandKit.doEmpty")}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-destructive">
            <ThumbsDown className="size-4" />
            {t("clientSettings.brandKit.dontLabel")}
          </Label>
          <StringListEditor
            items={dontList}
            onChange={setDontList}
            placeholder={t("clientSettings.brandKit.dontPlaceholder")}
            addLabel={t("clientSettings.brandKit.addLabel")}
            emptyLabel={t("clientSettings.brandKit.dontEmpty")}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>
          <ShieldAlert className="size-4 text-destructive" />
          {t("clientSettings.brandKit.bannedLabel")}
        </Label>
        <BannedWordsEditor words={bannedWords} onChange={setBannedWords} />
        <p className="text-xs text-muted-foreground">{t("clientSettings.brandKit.bannedHint")}</p>
      </div>

      <SaveBar dirty={dirty && !pending} onSave={save} />
    </SectionCard>
  )
}
