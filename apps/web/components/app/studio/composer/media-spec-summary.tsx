"use client"

import { PlatformIcon } from "@/components/shared/platform-badge"
import { SpecIssues } from "@/components/shared/spec-issues"
import type { Platform } from "@/lib/domain"
import { useLabels, useT } from "@/lib/i18n"
import { type SpecIssue, validateMedia } from "@/lib/specs"
import type { ComposerDraft, ComposerMedia } from "./composer-types"

// Récapitulatif des specs médias par plateforme ciblée (validateMedia) +
// limites de carrousel — rejoué à chaque changement de média, cible ou format.

export function MediaSpecSummary({
  media,
  platforms,
  draft,
  carouselIssues,
}: {
  media: ComposerMedia[]
  platforms: Platform[]
  draft: ComposerDraft
  carouselIssues: SpecIssue[]
}) {
  const t = useT()
  const lbl = useLabels()
  if (media.length === 0 && carouselIssues.length === 0) return null

  const groups = platforms
    .map((platform) => ({
      platform,
      issues: media.flatMap((m) => validateMedia(m, platform, draft.format)),
    }))
    .filter((g) => g.issues.length > 0)

  if (groups.length === 0 && carouselIssues.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
      <p className="text-xs font-medium">{t("composer.media.specsTitle")}</p>
      {carouselIssues.length > 0 ? <SpecIssues issues={carouselIssues} /> : null}
      {groups.map((g) => (
        <div key={g.platform} className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PlatformIcon platform={g.platform} className="size-3.5" />
            {lbl.platform(g.platform)}
          </p>
          <SpecIssues issues={g.issues} />
        </div>
      ))}
    </div>
  )
}
