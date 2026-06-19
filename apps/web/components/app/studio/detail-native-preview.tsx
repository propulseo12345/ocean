"use client"

import {
  Bookmark,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react"
import { useState } from "react"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IG_TRUNCATE_AT } from "@/lib/caption"
import { formatRelative } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import type { Client, ContentItem, Platform, SocialAccount } from "@/lib/mocks/types"
import { DetailPreviewMedia } from "./detail-preview-media"

// Aperçu natif « comme sur la plateforme » : post feed Instagram (header
// compte, actions, coupure « … plus » à ~125 caractères) et variante
// Facebook. Bascule par plateforme ciblée. Rendu indicatif, recréé léger
// (pattern du composer, sans dépendre de ses composants).

type PreviewPlatform = Extract<Platform, "instagram" | "facebook">

export function DetailNativePreview({
  client,
  content,
  accounts,
}: {
  client: Client
  content: ContentItem
  accounts: SocialAccount[]
}) {
  const platforms = previewPlatforms(content)
  const [tab, setTab] = useState<PreviewPlatform | null>(null)
  const [slide, setSlide] = useState(0)

  if (platforms.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aperçu natif disponible pour Instagram et Facebook — ce contenu ne cible aucune de ces
        plateformes.
      </p>
    )
  }

  const platform: PreviewPlatform = tab && platforms.includes(tab) ? tab : platforms[0]
  const account = accounts.find((a) => a.platform === platform) ?? null
  const caption =
    content.targets.find((t) => t.platform === platform)?.captionOverride ?? content.caption
  const hashtags = content.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
  const vertical = content.format === "reel" || content.format === "story"
  const dateLabel = content.scheduledAt ? formatRelative(content.scheduledAt) : "à programmer"

  return (
    <div className="space-y-3">
      {platforms.length > 1 ? (
        <Tabs value={platform} onValueChange={(v) => setTab(v as PreviewPlatform)}>
          <TabsList>
            {platforms.map((p) => (
              <TabsTrigger key={p} value={p}>
                <PlatformIcon platform={p} className="size-3.5" />
                {platformMeta[p].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="mx-auto w-full max-w-80 overflow-hidden rounded-xl border bg-background">
        <header className="flex items-center gap-2 px-3 py-2">
          <ClientAvatar client={client} size={28} className="rounded-full" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold">
              {platform === "facebook"
                ? (account?.displayName ?? client.name)
                : (account?.username ?? client.handle)}
            </p>
            {platform === "facebook" ? (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {dateLabel} · <Globe className="size-2.5" />
              </p>
            ) : null}
          </div>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </header>

        {platform === "facebook" ? (
          <CaptionBlock
            caption={caption}
            hashtags={hashtags}
            platform={platform}
            className="px-3 pb-2"
          />
        ) : null}

        <DetailPreviewMedia
          content={content}
          vertical={vertical}
          slide={slide}
          onSlide={setSlide}
        />

        <div className="space-y-1.5 px-3 py-2.5">
          {platform === "instagram" ? (
            <>
              <div className="flex items-center gap-3 py-0.5 text-foreground/80">
                <Heart className="size-5" />
                <MessageCircle className="size-5" />
                <Send className="size-5" />
                <Bookmark className="ml-auto size-5" />
              </div>
              <CaptionBlock
                caption={caption}
                hashtags={hashtags}
                platform={platform}
                handle={account?.username ?? client.handle}
              />
              {content.firstComment ? (
                <p className="border-t pt-1.5 text-xs break-words text-muted-foreground">
                  <span className="font-semibold text-foreground/80">
                    {account?.username ?? client.handle}
                  </span>{" "}
                  {content.firstComment}
                </p>
              ) : null}
              <p className="text-[10px] text-muted-foreground uppercase">{dateLabel}</p>
            </>
          ) : (
            <div className="flex items-center justify-around border-t pt-1.5 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ThumbsUp className="size-3.5" /> J'aime
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5" /> Commenter
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Share2 className="size-3.5" /> Partager
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Rendu indicatif — la coupure « … plus » est une estimation (~{IG_TRUNCATE_AT} caractères).
      </p>
    </div>
  )
}

function previewPlatforms(content: ContentItem): PreviewPlatform[] {
  const targeted = new Set(content.targets.map((t) => t.platform))
  const out: PreviewPlatform[] = []
  if (targeted.has("instagram")) out.push("instagram")
  if (targeted.has("facebook")) out.push("facebook")
  return out
}

function CaptionBlock({
  caption,
  hashtags,
  platform,
  handle,
  className,
}: {
  caption: string
  hashtags: string
  platform: PreviewPlatform
  handle?: string
  className?: string
}) {
  const chars = [...caption]
  const truncates = platform === "instagram" && chars.length > IG_TRUNCATE_AT

  return (
    <div className={className}>
      <p className="text-xs leading-relaxed break-words whitespace-pre-line">
        {handle ? <span className="font-semibold">{handle} </span> : null}
        {truncates ? (
          <>
            {chars.slice(0, IG_TRUNCATE_AT).join("")}
            <span
              className="mx-0.5 rounded bg-warning/15 px-1 font-medium text-warning"
              title={`Instagram coupe ici dans le feed (~${IG_TRUNCATE_AT} caractères)`}
            >
              … plus
            </span>
            <span className="text-muted-foreground/50">{chars.slice(IG_TRUNCATE_AT).join("")}</span>
          </>
        ) : (
          caption
        )}
      </p>
      {hashtags.length > 0 ? (
        <p className="mt-1 text-xs break-words text-info">{hashtags}</p>
      ) : null}
    </div>
  )
}
