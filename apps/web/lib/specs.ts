import type { ContentFormat, MediaType, Platform } from "@/lib/domain"
import type { MessageKey, MessageParams } from "@/lib/i18n"

// Specs médias par plateforme (état réel des API, juin 2026) + validation.
// Les messages sont retournés sous forme {key, params} et résolus à l'affichage
// (SpecIssues) via t() — bilingue FR/EN.

export type SpecSeverity = "error" | "warning"

export interface SpecIssue {
  severity: SpecSeverity
  key: MessageKey
  params?: MessageParams
}

/** Forme minimale validable — MediaAsset et LibraryAsset la satisfont. */
export interface MediaCheck {
  type: MediaType
  width: number
  height: number
  durationSec?: number
  fileSizeMb?: number
  mimeType?: string
}

export const IG_IMAGE_RATIO = { min: 0.8, max: 1.91 } // 4:5 à 1.91:1
export const IG_IMAGE_MAX_MB = 8
export const IG_REEL_DURATION = { min: 3, max: 900 } // 3 s à 15 min
export const REEL_MAX_MB = 300
export const FB_REEL_DURATION = { min: 3, max: 90 }
export const TIKTOK_DURATION = { min: 3, max: 600 }
export const STORY_MAX_SEC = 60
export const VERTICAL_RATIO = 9 / 16
export const CAROUSEL_LIMITS = { min: 2, max: 10 } // limite API Meta

const RATIO_TOLERANCE = 0.04
const JPEG_TYPES = ["image/jpeg", "image/jpg"]
const VIDEO_TYPES = ["video/mp4", "video/quicktime"]

// Descripteur de cible utilisé dans certains messages (clé i18n + valeur).
type SpecTarget = "reel" | "story"

/** Libellé lisible d'un ratio : "4:5", "1:1", "9:16", "1.91:1"… (indépendant de la langue) */
export function ratioLabel(width: number, height: number): string {
  const known: Array<[number, string]> = [
    [0.8, "4:5"],
    [1, "1:1"],
    [VERTICAL_RATIO, "9:16"],
    [1.91, "1.91:1"],
    [4 / 3, "4:3"],
    [3 / 4, "3:4"],
  ]
  const r = width / height
  const hit = known.find(([value]) => Math.abs(r - value) < RATIO_TOLERANCE)
  return hit ? hit[1] : `${(Math.round(r * 100) / 100).toFixed(2)}:1`
}

function issue(severity: SpecSeverity, key: MessageKey, params?: MessageParams): SpecIssue {
  return { severity, key, params }
}

function checkVertical(media: MediaCheck, target: SpecTarget): SpecIssue[] {
  const r = media.width / media.height
  if (Math.abs(r - VERTICAL_RATIO) > RATIO_TOLERANCE) {
    return [
      issue("warning", "specs.crop916", {
        target,
        current: ratioLabel(media.width, media.height),
      }),
    ]
  }
  return []
}

function checkInstagramImage(media: MediaCheck): SpecIssue[] {
  const issues: SpecIssue[] = []
  const r = media.width / media.height
  if (r < IG_IMAGE_RATIO.min - RATIO_TOLERANCE || r > IG_IMAGE_RATIO.max + RATIO_TOLERANCE) {
    issues.push(
      issue("error", "specs.igRatioOut", { ratio: ratioLabel(media.width, media.height) })
    )
  }
  if (media.fileSizeMb !== undefined && media.fileSizeMb > IG_IMAGE_MAX_MB) {
    issues.push(
      issue("error", "specs.igImageTooBig", { size: media.fileSizeMb, max: IG_IMAGE_MAX_MB })
    )
  }
  if (media.mimeType && !JPEG_TYPES.includes(media.mimeType)) {
    issues.push(issue("warning", "specs.notJpeg"))
  }
  return issues
}

function checkVideo(
  media: MediaCheck,
  bounds: { min: number; max: number },
  platform: Platform
): SpecIssue[] {
  const issues: SpecIssue[] = []
  if (media.type !== "video") {
    issues.push(issue("error", "specs.videoRequired", { platform: platformName(platform) }))
    return issues
  }
  if (media.mimeType && !VIDEO_TYPES.includes(media.mimeType)) {
    issues.push(issue("error", "specs.videoFormat"))
  }
  if (media.durationSec !== undefined) {
    if (media.durationSec < bounds.min) {
      issues.push(
        issue("error", "specs.videoTooShort", { min: bounds.min, platform: platformName(platform) })
      )
    } else if (media.durationSec > bounds.max) {
      const max = bounds.max >= 60 ? `${Math.round(bounds.max / 60)} min` : `${bounds.max} s`
      issues.push(issue("error", "specs.videoTooLong", { max, platform: platformName(platform) }))
    }
  }
  if (media.fileSizeMb !== undefined && media.fileSizeMb > REEL_MAX_MB) {
    issues.push(issue("error", "specs.videoTooBig", { size: media.fileSizeMb, max: REEL_MAX_MB }))
  }
  return issues
}

// Nom propre (non traduit) pour interpolation dans les messages.
function platformName(p: Platform): string {
  if (p === "tiktok") return "TikTok"
  if (p === "facebook") return "Facebook"
  return "Instagram"
}

/** Valide un média pour une plateforme et un format ciblés → issues {key, params}. */
export function validateMedia(
  media: MediaCheck,
  platform: Platform,
  format: ContentFormat
): SpecIssue[] {
  if (platform === "newsletter" || platform === "custom") return []

  if (format === "reel") {
    const bounds =
      platform === "tiktok"
        ? TIKTOK_DURATION
        : platform === "facebook"
          ? FB_REEL_DURATION
          : IG_REEL_DURATION
    return [...checkVideo(media, bounds, platform), ...checkVertical(media, "reel")]
  }

  if (format === "story") {
    const issues = checkVertical(media, "story")
    if (
      media.type === "video" &&
      media.durationSec !== undefined &&
      media.durationSec > STORY_MAX_SEC
    ) {
      issues.push(issue("error", "specs.storyTooLong", { max: STORY_MAX_SEC }))
    }
    return issues
  }

  // post / carousel
  if (media.type === "video") {
    return platform === "instagram" ? [issue("warning", "specs.feedVideoAsReel")] : []
  }
  return platform === "instagram" ? checkInstagramImage(media) : []
}

/** Valide le nombre de visuels d'un carrousel (limite API Meta : 10). */
export function validateCarousel(slideCount: number): SpecIssue[] {
  if (slideCount > CAROUSEL_LIMITS.max) {
    return [issue("error", "specs.carouselMax", { max: CAROUSEL_LIMITS.max })]
  }
  if (slideCount < CAROUSEL_LIMITS.min) {
    return [issue("warning", "specs.carouselMin", { min: CAROUSEL_LIMITS.min })]
  }
  return []
}
