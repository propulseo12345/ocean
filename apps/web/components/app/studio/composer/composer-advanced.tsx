"use client"

import { Info, LinkIcon, MapPin } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { platformMeta } from "@/lib/mocks/labels"
import type { Platform } from "@/lib/mocks/types"
import type { ComposerDraft } from "./composer-types"

// Options avancées par plateforme ciblée — uniquement des champs crédibles
// côté API (état réel juin 2026) : lieu IG, lien sortant FB, rappel TikTok.

export function ComposerAdvanced({
  draft,
  platforms,
  onPatch,
}: {
  draft: ComposerDraft
  platforms: Platform[]
  onPatch: (partial: Partial<ComposerDraft>) => void
}) {
  if (platforms.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Options avancées par plateforme</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion>
          {platforms.includes("instagram") ? (
            <AccordionItem value="instagram">
              <AccordionTrigger className="gap-2">
                <span className="inline-flex items-center gap-2">
                  <PlatformIcon platform="instagram" className="size-4" />
                  {platformMeta.instagram.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Label htmlFor="composer-ig-location" className="gap-1.5 text-xs">
                  <MapPin className="size-3.5" />
                  Lieu (géotag)
                </Label>
                <Input
                  id="composer-ig-location"
                  value={draft.igLocation}
                  onChange={(e) => onPatch({ igLocation: e.target.value })}
                  placeholder="Ex. : Lille, France"
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" />
                  Identification de comptes et posts collab indisponibles au MVP (variante API
                  Instagram Login).
                </p>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {platforms.includes("facebook") ? (
            <AccordionItem value="facebook">
              <AccordionTrigger className="gap-2">
                <span className="inline-flex items-center gap-2">
                  <PlatformIcon platform="facebook" className="size-4" />
                  {platformMeta.facebook.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Label htmlFor="composer-fb-link" className="gap-1.5 text-xs">
                  <LinkIcon className="size-3.5" />
                  Lien sortant
                </Label>
                <Input
                  id="composer-fb-link"
                  type="url"
                  value={draft.fbLink}
                  onChange={(e) => onPatch({ fbLink: e.target.value })}
                  placeholder="https://…"
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" />
                  Affiché en aperçu de lien sous le post Facebook.
                </p>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {platforms.includes("tiktok") ? (
            <AccordionItem value="tiktok">
              <AccordionTrigger className="gap-2">
                <span className="inline-flex items-center gap-2">
                  <PlatformIcon platform="tiktok" className="size-4" />
                  {platformMeta.tiktok.label}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" />
                  Publication en brouillon : confidentialité, duo/collage et commentaires se règlent
                  dans l'app TikTok à la finalisation. Tu recevras une notification à l'heure
                  programmée avec la légende à coller.
                </p>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </CardContent>
    </Card>
  )
}
