import type {
  ContentFormat,
  ContentItem,
  LibraryAsset,
  MediaType,
  Platform,
  SocialAccount,
} from "@/lib/domain"
import type { Locale } from "@/lib/i18n"

// Types du composer (état local UI — preview, aucune écriture réelle).
// Le brouillon reflète l'anatomie d'un ContentItem du PRD §5.B pour brancher
// le backend plus tard sans réécrire l'UI.

export type CropPreset = "1:1" | "4:5" | "9:16"

export const CROP_PRESETS: Record<CropPreset, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
}

/** Poids simulé après compression JPEG (recadrage mock). */
const RECOMPRESSED_MB = 7.6
const IG_IMAGE_MAX_MB = 8

export interface ComposerMedia {
  id: string
  type: MediaType
  thumbUrl: string
  fullUrl: string
  width: number
  height: number
  durationSec?: number
  fileSizeMb?: number
  mimeType?: string
  altText: string
  /** Asset de médiathèque d'origine (si sélectionné depuis le picker). */
  libraryAssetId?: string
  /** Preset de recadrage appliqué (mock — aucun traitement d'image réel). */
  crop?: CropPreset
}

export type DraftState = "idea" | "draft"

export interface ComposerDraft {
  title: string
  format: ContentFormat
  state: DraftState
  pillarId: string | null
  caption: string
  /** Légendes déclinées : absent = hérite de la légende commune. */
  captionOverrides: Partial<Record<Platform, string>>
  firstComment: string
  media: ComposerMedia[]
  /** Comptes sociaux ciblés (SocialAccount.id). */
  accountIds: string[]
  /** Canaux manuels ciblés (newsletter / sur-mesure). */
  manualPlatforms: Platform[]
  newsletterSubject: string
  internalNotes: string
  labels: string[]
  /** ISO UTC — null tant que non programmé. */
  scheduledAt: string | null
  /** Options avancées crédibles côté API. */
  igLocation: string
  fbLink: string
}

export function mediaFromLibrary(
  asset: LibraryAsset,
  position: number,
  locale: Locale
): ComposerMedia {
  return {
    id: `cm_${asset.id}_${position}`,
    type: asset.type,
    thumbUrl: asset.thumbUrl,
    fullUrl: asset.fullUrl,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    fileSizeMb: asset.fileSizeMb,
    mimeType: asset.mimeType,
    altText: asset.altText ? asset.altText : "",
    libraryAssetId: asset.id,
  }
}

/** Applique un preset de recadrage mock : dimensions + conversion JPEG simulée. */
export function applyCrop(media: ComposerMedia, preset: CropPreset): ComposerMedia {
  const dims = CROP_PRESETS[preset]
  const oversize = media.fileSizeMb !== undefined && media.fileSizeMb > IG_IMAGE_MAX_MB
  return {
    ...media,
    width: dims.width,
    height: dims.height,
    crop: preset,
    mimeType: media.type === "image" ? "image/jpeg" : media.mimeType,
    fileSizeMb: oversize ? RECOMPRESSED_MB : media.fileSizeMb,
  }
}

export function emptyDraft(accounts: SocialAccount[]): ComposerDraft {
  // Présélection naturelle : le compte Instagram du client (cœur du produit).
  const ig = accounts.find((a) => a.platform === "instagram")
  return {
    title: "",
    format: "post",
    state: "draft",
    pillarId: null,
    caption: "",
    captionOverrides: {},
    firstComment: "",
    media: [],
    accountIds: ig ? [ig.id] : [],
    manualPlatforms: [],
    newsletterSubject: "",
    internalNotes: "",
    labels: [],
    scheduledAt: null,
    igLocation: "",
    fbLink: "",
  }
}

export function draftFromContent(content: ContentItem, locale: Locale): ComposerDraft {
  const overrides: Partial<Record<Platform, string>> = {}
  const accountIds: string[] = []
  const manualPlatforms: Platform[] = []
  for (const target of content.targets) {
    if (target.captionOverride) overrides[target.platform] = target.captionOverride
    if (target.socialAccountId) accountIds.push(target.socialAccountId)
    else manualPlatforms.push(target.platform)
  }

  // Les hashtags du modèle vivent à part : on les réinjecte dans la légende
  // (le composer travaille en « hashtags inline », cf. lib/caption.ts).
  const tags = content.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
  const captionText = content.caption
  const caption = tags ? `${captionText}\n\n${tags}` : captionText

  return {
    title: content.title,
    format: content.format,
    state: content.status === "idea" ? "idea" : "draft",
    pillarId: content.pillarId ?? null,
    caption,
    captionOverrides: overrides,
    firstComment: content.firstComment ? content.firstComment : "",
    media: [...content.media]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        type: m.type,
        thumbUrl: m.thumbUrl,
        fullUrl: m.fullUrl,
        width: m.width,
        height: m.height,
        durationSec: m.durationSec,
        fileSizeMb: m.fileSizeMb,
        mimeType: m.mimeType,
        altText: m.altText ? m.altText : "",
      })),
    accountIds,
    manualPlatforms,
    newsletterSubject: content.newsletterSubject ? content.newsletterSubject : "",
    internalNotes: content.internalNotes ? content.internalNotes : "",
    labels: content.labels ? content.labels : [],
    scheduledAt: content.scheduledAt,
    igLocation: content.igLocation ?? "",
    fbLink: content.fbLink ?? "",
  }
}
