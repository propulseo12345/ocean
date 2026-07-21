// Ocean — types médiathèque, hashtags et métriques de performance.

import type { L } from "@/lib/i18n/localized"
import type { EngagementStats, MediaType } from "./core"

/** Provenance d'un asset de médiathèque. */
export type LibraryAssetSource = "upload" | "depot_client" | "import"

/** Asset de la médiathèque client (indépendant des contenus). */
export interface LibraryAsset {
  id: string
  clientId: string
  type: MediaType
  thumbUrl: string
  fullUrl: string
  width: number
  height: number
  durationSec?: number
  uploadedAt: string
  source: LibraryAssetSource
  /** Contenus dans lesquels l'asset est utilisé ([] = inédit). */
  usedInContentIds: string[]
  altText?: string
  /** Poids simulé en Mo — pour la validation des specs plateformes. */
  fileSizeMb?: number
  /** Type MIME simulé (ex. "image/jpeg", "image/heic", "video/mp4"). */
  mimeType?: string
}

/** Groupe de hashtags nommé, insérable en un clic dans une légende. */
export interface HashtagGroup {
  id: string
  clientId: string
  name: string
  /** Tags avec leur « # », ex. ["#brunch", "#foodie"]. */
  tags: string[]
}

/** Métriques rattachées à un post (app ou importé) pour la page Performance. */
export interface PostMetrics extends EngagementStats {
  /** ContentItem.id ou ImportedPost.id. */
  refId: string
}
