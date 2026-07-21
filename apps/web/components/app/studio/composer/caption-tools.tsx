"use client"

import { Scissors, TriangleAlert } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import {
  findBannedWords,
  getCaptionStats,
  getHashtagStats,
  IG_HASHTAG_LIMIT,
  IG_TRUNCATE_AT,
} from "@/lib/caption"
import type { Platform } from "@/lib/domain"
import { INTL_LOCALE, useLocale, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Outils de légende : compteurs par plateforme, garde-fous brand kit,
// statistiques de hashtags (≤30 cumulés légende + 1er commentaire IG).

export function CaptionCounters({
  texts,
  platforms,
}: {
  /** Légende effective par plateforme (déclinaison ou commune). */
  texts: Record<string, string>
  platforms: Platform[]
}) {
  const t = useT()
  const { locale } = useLocale()
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale])
  if (platforms.length === 0) return null

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {platforms.map((platform) => {
        const stats = getCaptionStats(texts[platform] ?? "", platform)
        if (stats.limit === null) return null
        return (
          <li
            key={platform}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs tabular-nums",
              stats.overLimit ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            <PlatformIcon platform={platform} className="size-3.5" />
            {nf.format(stats.length)}/{nf.format(stats.limit)}
            {stats.overLimit ? (
              <span className="inline-flex items-center gap-1">
                <TriangleAlert className="size-3" />
                {t("composer.tools.over")}
              </span>
            ) : null}
            {platform === "instagram" && stats.truncatesInFeed && !stats.overLimit ? (
              <span
                className="inline-flex items-center gap-1 text-warning"
                title={t("composer.tools.truncateTitle", { count: IG_TRUNCATE_AT })}
              >
                <Scissors className="size-3" />
                {t("composer.tools.truncateAfter", { count: IG_TRUNCATE_AT })}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function BannedWordsHint({ text, bannedWords }: { text: string; bannedWords: string[] }) {
  const t = useT()
  const { locale } = useLocale()
  const hits = findBannedWords(text, bannedWords)
  if (hits.length === 0) return null
  const unique = [...new Set(hits.map((h) => h.word))]
  const quote = (w: string) => (locale === "fr" ? `« ${w} »` : `"${w}"`)

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
      <p>
        <span className="font-medium text-warning">{t("composer.tools.bannedTitle")} </span>
        {unique.map(quote).join(" · ")} {t("composer.tools.bannedSuffix")}
      </p>
    </div>
  )
}

export function HashtagStatsLine({
  caption,
  firstComment,
}: {
  caption: string
  firstComment: string
}) {
  const t = useT()
  const stats = getHashtagStats(caption, firstComment)
  if (stats.total === 0) return null

  return (
    <div className="space-y-1">
      <p
        className={cn(
          "text-xs tabular-nums",
          stats.overLimit ? "font-medium text-destructive" : "text-muted-foreground"
        )}
      >
        {t("composer.tools.hashtagStats", {
          total: stats.total,
          limit: IG_HASHTAG_LIMIT,
          inCaption: stats.inCaption,
          inFirstComment: stats.inFirstComment,
        })}
        {stats.overLimit ? t("composer.tools.hashtagOver") : ""}
      </p>
      {stats.duplicates.length > 0 ? (
        <p className="inline-flex items-center gap-1 text-xs text-warning">
          <TriangleAlert className="size-3" />
          {t("composer.tools.hashtagDuplicates", { words: stats.duplicates.join(" ") })}
        </p>
      ) : null}
    </div>
  )
}
