import { Scissors, TriangleAlert } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import {
  findBannedWords,
  getCaptionStats,
  getHashtagStats,
  IG_HASHTAG_LIMIT,
  IG_TRUNCATE_AT,
} from "@/lib/caption"
import type { Platform } from "@/lib/mocks/types"
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
            {stats.length.toLocaleString("fr-FR")}/{stats.limit.toLocaleString("fr-FR")}
            {stats.overLimit ? (
              <span className="inline-flex items-center gap-1">
                <TriangleAlert className="size-3" />
                dépassement
              </span>
            ) : null}
            {platform === "instagram" && stats.truncatesInFeed && !stats.overLimit ? (
              <span
                className="inline-flex items-center gap-1 text-warning"
                title={`Instagram coupe la légende après ~${IG_TRUNCATE_AT} caractères dans le feed`}
              >
                <Scissors className="size-3" />« … plus » après {IG_TRUNCATE_AT}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function BannedWordsHint({ text, bannedWords }: { text: string; bannedWords: string[] }) {
  const hits = findBannedWords(text, bannedWords)
  if (hits.length === 0) return null
  const unique = [...new Set(hits.map((h) => h.word))]

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
      <p>
        <span className="font-medium text-warning">Mots à éviter (brand kit) : </span>
        {unique.map((w) => `« ${w} »`).join(" · ")} — corrige ou assume avant l'envoi en validation.
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
        {stats.total}/{IG_HASHTAG_LIMIT} hashtags Instagram (légende {stats.inCaption} · premier
        commentaire {stats.inFirstComment}){stats.overLimit ? " — limite dépassée" : ""}
      </p>
      {stats.duplicates.length > 0 ? (
        <p className="inline-flex items-center gap-1 text-xs text-warning">
          <TriangleAlert className="size-3" />
          Doublons légende / commentaire : {stats.duplicates.join(" ")}
        </p>
      ) : null}
    </div>
  )
}
