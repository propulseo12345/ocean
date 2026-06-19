"use client"

import { MessageCircle, RotateCcw } from "lucide-react"
import { useState } from "react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useLabels, useT } from "@/lib/i18n"
import { platformMeta } from "@/lib/mocks/labels"
import type { HashtagGroup, Platform } from "@/lib/mocks/types"
import { BannedWordsHint, CaptionCounters, HashtagStatsLine } from "./caption-tools"
import type { ComposerDraft } from "./composer-types"
import { appendHashtags, effectiveCaption } from "./composer-utils"
import { HashtagPopover } from "./hashtag-popover"

// Section « Légende » : légende commune + déclinaisons par plateforme
// (héritée / personnalisée), compteurs, garde-fous brand kit, groupes de
// hashtags et premier commentaire Instagram.

const COMMON_TAB = "common"

export function ComposerCaption({
  draft,
  platforms,
  hashtagGroups,
  bannedWords,
  onPatch,
}: {
  draft: ComposerDraft
  platforms: Platform[]
  hashtagGroups: HashtagGroup[]
  bannedWords: string[]
  onPatch: (partial: Partial<ComposerDraft>) => void
}) {
  const t = useT()
  const lbl = useLabels()
  const [tab, setTab] = useState<string>(COMMON_TAB)
  const activeTab = tab !== COMMON_TAB && !platforms.includes(tab as Platform) ? COMMON_TAB : tab

  const effectiveTexts = Object.fromEntries(
    platforms.map((p) => [p, effectiveCaption(draft, p)])
  ) as Record<string, string>

  function setOverride(platform: Platform, value: string | undefined) {
    const next = { ...draft.captionOverrides }
    if (value === undefined) delete next[platform]
    else next[platform] = value
    onPatch({ captionOverrides: next })
  }

  const igTargeted = platforms.includes("instagram")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("composer.caption.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setTab(String(v))}>
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList>
              <TabsTrigger value={COMMON_TAB}>{t("composer.caption.commonTab")}</TabsTrigger>
              {platforms.map((p) => (
                <TabsTrigger key={p} value={p} className="gap-1.5">
                  <PlatformIcon platform={p} className="size-3.5" />
                  {platformMeta[p].label}
                  {draft.captionOverrides[p] !== undefined ? (
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={COMMON_TAB} className="space-y-3">
            <Textarea
              value={draft.caption}
              onChange={(e) => onPatch({ caption: e.target.value })}
              placeholder={t("composer.caption.commonPlaceholder")}
              aria-label={t("composer.caption.commonAria")}
              className="min-h-36"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <HashtagPopover
                groups={hashtagGroups}
                destinationLabel={t("composer.caption.destinationCaption")}
                onInsert={(tags) => onPatch({ caption: appendHashtags(draft.caption, tags) })}
              />
              <CaptionCounters texts={effectiveTexts} platforms={platforms} />
            </div>
            <BannedWordsHint text={draft.caption} bannedWords={bannedWords} />
          </TabsContent>

          {platforms.map((platform) => {
            const override = draft.captionOverrides[platform]
            const customized = override !== undefined
            return (
              <TabsContent key={platform} value={platform} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={
                      customized ? "border-primary/40 text-primary" : "text-muted-foreground"
                    }
                  >
                    {customized
                      ? t("composer.caption.customized")
                      : t("composer.caption.inherited")}
                  </Badge>
                  {customized ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setOverride(platform, undefined)}
                    >
                      <RotateCcw />
                      {t("composer.caption.backToCommon")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setOverride(platform, draft.caption)}
                    >
                      {t("composer.caption.customizeFor", { platform: lbl.platform(platform) })}
                    </Button>
                  )}
                </div>

                {customized ? (
                  <Textarea
                    value={override}
                    onChange={(e) => setOverride(platform, e.target.value)}
                    aria-label={t("composer.caption.captionFor", {
                      platform: lbl.platform(platform),
                    })}
                    className="min-h-36"
                  />
                ) : (
                  <div className="min-h-24 rounded-lg border border-dashed bg-muted/30 p-2.5 text-sm whitespace-pre-line text-muted-foreground">
                    {draft.caption.trim().length > 0
                      ? draft.caption
                      : t("composer.caption.commonEmpty")}
                  </div>
                )}

                <CaptionCounters texts={effectiveTexts} platforms={[platform]} />
                {customized ? <BannedWordsHint text={override} bannedWords={bannedWords} /> : null}
              </TabsContent>
            )
          })}
        </Tabs>

        {igTargeted ? (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="composer-first-comment" className="gap-1.5">
              <MessageCircle className="size-3.5" />
              {t("composer.caption.firstComment")}
            </Label>
            <Textarea
              id="composer-first-comment"
              value={draft.firstComment}
              onChange={(e) => onPatch({ firstComment: e.target.value })}
              placeholder={t("composer.caption.firstCommentPlaceholder")}
              className="min-h-20"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <HashtagPopover
                groups={hashtagGroups}
                destinationLabel={t("composer.caption.destinationFirstComment")}
                onInsert={(tags) =>
                  onPatch({ firstComment: appendHashtags(draft.firstComment, tags) })
                }
              />
              <HashtagStatsLine
                caption={effectiveCaption(draft, "instagram")}
                firstComment={draft.firstComment}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
