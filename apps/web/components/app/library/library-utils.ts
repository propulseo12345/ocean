import type { LibraryAsset, LibraryAssetSource } from "@/lib/mocks/types"
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

export const sourceMeta: Record<
  LibraryAssetSource,
  { label: string; verb: string; chipClass: string }
> = {
  upload: { label: "Upload", verb: "Ajouté le", chipClass: "bg-muted text-muted-foreground" },
  depot_client: {
    label: "Déposé par le client",
    verb: "Reçu le",
    chipClass: "bg-info/10 text-info",
  },
  import: { label: "Importé", verb: "Importé le", chipClass: "bg-secondary text-foreground/70" },
}

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

export function mimeLabel(asset: LibraryAsset): string {
  return MIME_EXT[asset.mimeType ?? ""]?.label ?? (asset.type === "video" ? "Vidéo" : "Image")
}

export function formatMb(mb: number): string {
  return `${mb.toLocaleString("fr-FR")} Mo`
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
    const haystack = `${asset.altText ?? ""} ${assetFileName(asset)}`.toLowerCase()
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
