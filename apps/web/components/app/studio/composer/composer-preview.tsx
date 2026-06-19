"use client"

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IG_TRUNCATE_AT } from "@/lib/caption"
import { platformMeta } from "@/lib/mocks/labels"
import type { Client, Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import type { ComposerDraft } from "./composer-types"
import { effectiveCaption } from "./composer-utils"

// Aperçu plateforme : rendu feed avec coupure « … plus » Instagram à 125
// caractères (la suite est grisée), carrousel navigable, formats verticaux.

export function ComposerPreview({
  client,
  draft,
  platforms,
}: {
  client: Client
  draft: ComposerDraft
  platforms: Platform[]
}) {
  const [tab, setTab] = useState<Platform | null>(null)
  const [slide, setSlide] = useState(0)

  const platform: Platform = tab && platforms.includes(tab) ? tab : (platforms[0] ?? "instagram")
  const caption = effectiveCaption(draft, platform)
  const vertical = draft.format === "reel" || draft.format === "story"
  const media = draft.media
  const slideIndex = Math.min(slide, Math.max(media.length - 1, 0))
  const current = media[slideIndex]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Aperçu</CardTitle>
        {platforms.length > 1 ? (
          <Tabs value={platform} onValueChange={(v) => setTab(v as Platform)}>
            <TabsList className="h-7">
              {platforms.map((p) => (
                <TabsTrigger key={p} value={p} aria-label={platformMeta[p].label}>
                  <PlatformIcon platform={p} className="size-3.5" />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </CardHeader>

      <CardContent>
        <div className="mx-auto w-full max-w-80 overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center gap-2 px-3 py-2">
            <ClientAvatar client={client} size={26} className="rounded-full" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold">{client.handle}</p>
              {draft.igLocation && platform === "instagram" ? (
                <p className="truncate text-[10px] text-muted-foreground">{draft.igLocation}</p>
              ) : null}
            </div>
            <PlatformIcon platform={platform} className="size-3.5 opacity-70" />
          </div>

          <div
            className={cn("relative w-full bg-muted", vertical ? "aspect-[9/16]" : "aspect-square")}
          >
            {current ? (
              <>
                <Image
                  src={current.fullUrl}
                  alt={current.altText || draft.title || "Aperçu du média"}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
                {media.length > 1 ? (
                  <>
                    <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm">
                      {slideIndex + 1}/{media.length}
                    </span>
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      aria-label="Slide précédente"
                      className="absolute top-1/2 left-1.5 -translate-y-1/2 rounded-full opacity-90"
                      onClick={() => setSlide((slideIndex - 1 + media.length) % media.length)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      aria-label="Slide suivante"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full opacity-90"
                      onClick={() => setSlide((slideIndex + 1) % media.length)}
                    >
                      <ChevronRight />
                    </Button>
                    <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
                      {media.map((m, i) => (
                        <span
                          key={m.id}
                          className={cn(
                            "size-1.5 rounded-full",
                            i === slideIndex ? "bg-white" : "bg-white/45"
                          )}
                        />
                      ))}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <ImageIcon className="size-5" />
                <span className="text-xs">Aucun média sélectionné</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 px-3 py-2.5">
            <CaptionPreview handle={client.handle} caption={caption} platform={platform} />
            {platform === "instagram" && draft.firstComment.trim().length > 0 ? (
              <p className="border-t pt-1.5 text-xs break-words text-muted-foreground">
                <span className="font-semibold text-foreground/80">{client.handle}</span>{" "}
                {draft.firstComment}
              </p>
            ) : null}
          </div>
        </div>

        {platforms.length === 0 ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Aucune plateforme ciblée — aperçu Instagram par défaut.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CaptionPreview({
  handle,
  caption,
  platform,
}: {
  handle: string
  caption: string
  platform: Platform
}) {
  if (caption.trim().length === 0) {
    return <p className="text-xs text-muted-foreground italic">Légende vide pour l'instant…</p>
  }

  const chars = [...caption]
  const truncates = platform === "instagram" && chars.length > IG_TRUNCATE_AT

  return (
    <p className="text-xs leading-relaxed break-words whitespace-pre-line">
      <span className="font-semibold">{handle}</span>{" "}
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
  )
}
