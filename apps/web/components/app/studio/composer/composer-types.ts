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

/**
 * Dimensions cibles de chaque preset, en pixels.
 *
 * ⚠ Ce sont les dimensions que le traitement d'image RÉEL devra produire — pas
 * celles d'un fichier existant. Jusqu'à P5-4, `applyCrop` les écrivait
 * directement sur le média sans toucher un pixel, ce qui faisait mentir le
 * preflight. Aucun code ne doit les recopier dans `ComposerMedia` tant que le
 * fichier n'a pas été réellement retaillé (session upload).
 */
export const CROP_TARGET_SIZES: Record<CropPreset, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
}

// P5-4 — `RECOMPRESSED_MB` (7,6 Mo) et `IG_IMAGE_MAX_MB` ont été SUPPRIMÉS d'ici.
// Ils servaient à fabriquer un poids « après compression » pour un fichier que
// personne ne compressait : voir `applyCrop`.

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

/** Convertit un asset tout juste téléversé en média du brouillon. */
export function mediaFromUpload(
  asset: {
    assetId: string
    type: MediaType
    thumbUrl: string
    fullUrl: string
    width: number
    height: number
    byteSize: number
    mimeType: string
    durationMs: number | null
  },
  position: number,
  crop?: CropPreset
): ComposerMedia {
  return {
    id: `cm_${asset.assetId}_${position}`,
    type: asset.type,
    thumbUrl: asset.thumbUrl,
    fullUrl: asset.fullUrl,
    // Ces quatre valeurs sont MESURÉES sur le fichier réellement produit
    // (canvas + `Blob.size`), pas déduites d'un preset : c'est ce qui rend le
    // preflight vrai à nouveau. Cf. `applyCrop` ci-dessous.
    width: asset.width,
    height: asset.height,
    fileSizeMb: Math.round((asset.byteSize / (1024 * 1024)) * 10) / 10,
    mimeType: asset.mimeType,
    durationSec: asset.durationMs != null ? Math.round(asset.durationMs / 1000) : undefined,
    altText: "",
    libraryAssetId: asset.assetId,
    crop,
  }
}

/**
 * Enregistre l'INTENTION de recadrage. Aucun pixel n'est touché — et c'est
 * précisément le point du ticket P5-4.
 *
 * CE QUE FAISAIT CETTE FONCTION, ET POURQUOI C'ÉTAIT DANGEREUX
 * -------------------------------------------------------------
 * Elle réécrivait `width`, `height`, `mimeType` et `fileSizeMb` comme si l'image
 * avait été traitée : dimensions du preset, `image/jpeg` d'office, et un poids
 * « après compression » inventé (7,6 Mo) dès que le fichier dépassait 8 Mo.
 *
 * Or le preflight (`lib/specs.ts`) valide EXACTEMENT ces quatre champs : ratio
 * 4:5–1.91:1, poids ≤ 8 Mo, JPEG obligatoire (règle 22). Un clic sur « 4:5 »
 * faisait donc passer au vert un PNG de 12 Mo en 3:4 — sans qu'aucun octet ne
 * change. Le preflight ne validait plus le fichier : il validait le clic.
 *
 * Le mensonge se payait au pire endroit possible. Le contenu partait en
 * programmation, le worker envoyait le fichier RÉEL à Instagram, Meta le
 * rejetait — erreur permanente, donc `failed` direct, sans retry (règle 18), sur
 * le compte d'un vrai client.
 *
 * CE QU'ELLE FAIT MAINTENANT
 * --------------------------
 * Elle pose `crop`, rien d'autre. Les caractéristiques mesurées du fichier
 * restent celles du fichier, donc le preflight redevient vrai : un PNG de 12 Mo
 * en 3:4 est signalé comme tel, dans le composer, AVANT toute programmation.
 *
 * Conséquence assumée : recadrer ne fait plus disparaître l'avertissement de
 * ratio. C'est honnête — rien n'est recadré. Le traitement réel (recadrage +
 * conversion JPEG + vignette WebP) appartient à la session upload, où il pourra
 * réécrire ces champs parce qu'il aura réellement réécrit le fichier.
 */
export function applyCrop(media: ComposerMedia, preset: CropPreset): ComposerMedia {
  return { ...media, crop: preset }
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
        // P5-2 — SANS cette ligne, rouvrir un contenu et l'enregistrer DÉTACHE
        // tous ses médias. La chaîne : `handleSave` ne garde que les médias
        // portant un `libraryAssetId` (composer-screen.tsx:145), parce qu'un
        // fichier fraîchement déposé n'existe pas encore en base ; cette
        // fonction n'en posait aucun ; donc `mediaPayload` sortait VIDE, et
        // `reconcileMedia` faisait son `delete()` puis retournait sur un tableau
        // vide (content.ts:219).
        //
        // Le coût réel dépasse les médias : `content_comments` porte
        // `annotation_content_media_id … on delete cascade` (013:138). Supprimer
        // les liaisons efface donc les COMMENTAIRES ANNOTÉS DU CLIENT — la ligne
        // entière, pas seulement son ancre. Le retour de validation disparaît.
        //
        // `m.id` est bien l'id de l'ASSET (content-media.ts:118), c'est-à-dire
        // exactement ce qu'attend `reconcileMedia` pour `media_asset_id`.
        libraryAssetId: m.id,
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
