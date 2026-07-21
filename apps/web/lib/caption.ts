import type { Platform } from "@/lib/domain"

// Compteurs et garde-fous de légende (composer studio).
// Limites réelles : IG 2 200, FB 63 206, TikTok 2 200 ; coupure feed IG ~125.

export const CAPTION_LIMITS: Partial<Record<Platform, number>> = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
}

/** Seuil de troncature « … plus » dans le feed Instagram (heuristique). */
export const IG_TRUNCATE_AT = 125

/** Hashtags max cumulés légende + premier commentaire (Instagram). */
export const IG_HASHTAG_LIMIT = 30

export interface CaptionStats {
  /** Longueur en points de code (emojis comptés correctement). */
  length: number
  /** Limite de la plateforme, null si aucune (newsletter, sur-mesure). */
  limit: number | null
  /** Caractères restants, null si pas de limite. */
  remaining: number | null
  overLimit: boolean
  /** true si la légende sera tronquée dans le feed IG (« … plus »). */
  truncatesInFeed: boolean
}

export function getCaptionStats(caption: string, platform: Platform): CaptionStats {
  const length = [...caption].length
  const limit = CAPTION_LIMITS[platform] ?? null
  return {
    length,
    limit,
    remaining: limit === null ? null : limit - length,
    overLimit: limit !== null && length > limit,
    truncatesInFeed: platform === "instagram" && length > IG_TRUNCATE_AT,
  }
}

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu

/** Hashtags d'un texte, en minuscules, sans doublons, ordre d'apparition. */
export function extractHashtags(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(HASHTAG_RE)) {
    const tag = match[0].toLowerCase()
    if (!out.includes(tag)) out.push(tag)
  }
  return out
}

export interface HashtagStats {
  inCaption: number
  inFirstComment: number
  total: number
  /** > 30 cumulés (limite Instagram). */
  overLimit: boolean
  /** Hashtags présents à la fois dans la légende et le premier commentaire. */
  duplicates: string[]
}

export function getHashtagStats(caption: string, firstComment = ""): HashtagStats {
  const inCaption = extractHashtags(caption)
  const inComment = extractHashtags(firstComment)
  const duplicates = inCaption.filter((tag) => inComment.includes(tag))
  const total = new Set([...inCaption, ...inComment]).size
  return {
    inCaption: inCaption.length,
    inFirstComment: inComment.length,
    total,
    overLimit: total > IG_HASHTAG_LIMIT,
    duplicates,
  }
}

export interface BannedWordHit {
  /** Mot interdit tel que défini au brand kit. */
  word: string
  /** Index de l'occurrence dans le texte original (pour le surlignage). */
  index: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Détecte les mots interdits du brand kit dans un texte (insensible à la
 * casse, bornes de mots respectées — « promo flash » ne matche pas « flashy »).
 */
export function findBannedWords(text: string, bannedWords: string[]): BannedWordHit[] {
  const hits: BannedWordHit[] = []
  for (const word of bannedWords) {
    const trimmed = word.trim()
    if (trimmed.length === 0) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`, "giu")
    for (const match of text.matchAll(re)) {
      hits.push({ word: trimmed, index: match.index })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}
