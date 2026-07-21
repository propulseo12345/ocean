import type { LibraryAsset, LibraryAssetSource } from "@/lib/domain"
import { INTL_LOCALE, type Locale, type MessageKey, type Translator } from "@/lib/i18n"
import { type SpecIssue, validateMedia } from "@/lib/specs"
import type { LibraryFilters, SortKey } from "./library-types"

// Helpers purs de la médiathèque : validation specs, libellés, filtres, tri.

/** Specs validées contre Instagram (image → post, vidéo → reel). */
export function assetIssues(asset: LibraryAsset): SpecIssue[] {
  return validateMedia(
    {
      type: asset.type,
      width: asset.width,
      height: asset.height,
      durationSec: asset.durationSec,
      fileSizeMb: asset.fileSizeMb,
      mimeType: asset.mimeType,
    },
    "instagram",
    asset.type === "video" ? "reel" : "post"
  )
}

export function hasSpecErrors(issues: SpecIssue[]): boolean {
  return issues.some((i) => i.severity === "error")
}

/** Métadonnées de source : clés i18n (résolues via t()) + classe de chip. */
export const sourceMeta: Record<
  LibraryAssetSource,
  { labelKey: MessageKey; verbKey: MessageKey; chipClass: string }
> = {
  upload: {
    labelKey: "library.source.upload",
    verbKey: "library.source.uploadVerb",
    chipClass: "bg-muted text-muted-foreground",
  },
  depot_client: {
    labelKey: "library.source.depositClient",
    verbKey: "library.source.depositVerb",
    chipClass: "bg-info/10 text-info",
  },
  import: {
    labelKey: "library.source.import",
    verbKey: "library.source.importVerb",
    chipClass: "bg-secondary text-foreground/70",
  },
}

// label = nom universel du format (non traduit) ; ext = extension de fichier.
const MIME_EXT: Record<string, { ext: string; label: string }> = {
  "image/jpeg": { ext: "jpg", label: "JPEG" },
  "image/jpg": { ext: "jpg", label: "JPEG" },
  "image/png": { ext: "png", label: "PNG" },
  "image/heic": { ext: "heic", label: "HEIC (iPhone)" },
  "video/mp4": { ext: "mp4", label: "MP4" },
  "video/quicktime": { ext: "mov", label: "MOV" },
}

/** Nom de fichier simulé, stable et lisible : « bru_3.jpg ». */
export function assetFileName(asset: LibraryAsset): string {
  const ext = MIME_EXT[asset.mimeType ?? ""]?.ext ?? (asset.type === "video" ? "mp4" : "jpg")
  return `${asset.id.replace(/^la_/, "")}.${ext}`
}

/** Libellé de format : nom universel (JPEG, MOV…) ou repli traduit (image/vidéo). */
export function mimeLabel(asset: LibraryAsset, t: Translator): string {
  return (
    MIME_EXT[asset.mimeType ?? ""]?.label ??
    t(asset.type === "video" ? "library.mime.video" : "library.mime.image")
  )
}

export function formatMb(mb: number, locale: Locale, t: Translator): string {
  return t("library.unit.mb", { value: mb.toLocaleString(INTL_LOCALE[locale]) })
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function matchesFilters(
  asset: LibraryAsset,
  filters: LibraryFilters,
  offSpec: boolean
): boolean {
  if (filters.type !== "all" && asset.type !== filters.type) return false
  if (filters.source !== "all" && asset.source !== filters.source) return false
  if (filters.usage === "used" && asset.usedInContentIds.length === 0) return false
  if (filters.usage === "unused" && asset.usedInContentIds.length > 0) return false
  if (filters.specs === "issues" && !offSpec) return false
  if (filters.search.trim()) {
    const needle = filters.search.trim().toLowerCase()
    // Le texte alternatif est monolingue (D1).
    const alt = asset.altText ?? ""
    const haystack = `${alt} ${assetFileName(asset)}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  return true
}

export function sortAssets(assets: LibraryAsset[], key: SortKey): LibraryAsset[] {
  const list = [...assets]
  if (key === "weight") {
    return list.sort((a, b) => (b.fileSizeMb ?? 0) - (a.fileSizeMb ?? 0))
  }
  if (key === "usage") {
    return list.sort(
      (a, b) =>
        b.usedInContentIds.length - a.usedInContentIds.length ||
        b.uploadedAt.localeCompare(a.uploadedAt)
    )
  }
  return list.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

// URL fictive de la preview — le vrai lien (portail Reviewer authentifié,
// décision PRD Q2) sera généré côté serveur au Lot 3.
export function buildDepositUrl(handle: string, validityDays: number): string {
  return `https://depot.ocean-preview.fr/${handle}?valide=${validityDays}j&jeton=apercu`
}
