import "server-only"

import type { MediaAsset, MediaType } from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

// Hydratation des médias d'un lot de contenus. Isolé de `content.ts` pour tenir
// la limite de taille de fichier, et parce que la résolution d'URL (vignette
// publique / original signé) est la seule partie dépendante du Storage.

const ORIGINALS_BUCKET = "media-originals"
const THUMBS_BUCKET = "media-thumbs"
const SIGNED_URL_TTL = 3600 // 1 h

interface AssetRow {
  id: string
  type: string
  storage_path: string | null
  thumb_path: string | null
  width: number | null
  height: number | null
  duration_ms: number | null
  alt_text: string | null
  byte_size: number | null
  mime_type: string | null
}

const ASSET_COLUMNS =
  "id, type, storage_path, thumb_path, width, height, duration_ms, alt_text, byte_size, mime_type"

/**
 * Résolveur d'URL de médias : vignette = URL publique (bucket media-thumbs),
 * original = URL signée 1 h générée en UN appel batch. Jamais d'URL stockée en
 * base, jamais d'original exposé publiquement (règle 20).
 */
export async function makeMediaUrlResolver(paths: (string | null)[]) {
  const supabase = await createClient()
  const originals = [...new Set(paths.filter((p): p is string => p !== null))]

  const signed = new Map<string, string>()
  if (originals.length > 0) {
    const { data } = await supabase.storage
      .from(ORIGINALS_BUCKET)
      .createSignedUrls(originals, SIGNED_URL_TTL)
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
    }
  }

  const thumbUrl = (path: string | null) =>
    path ? supabase.storage.from(THUMBS_BUCKET).getPublicUrl(path).data.publicUrl : ""

  return {
    thumbUrl,
    // Fallback sur la vignette : un original purgé (J+7) ne doit pas produire
    // une tuile vide, l'aperçu reste lisible.
    fullUrl: (storagePath: string | null, thumbPath: string | null) =>
      (storagePath ? signed.get(storagePath) : undefined) ?? thumbUrl(thumbPath),
  }
}

export interface ContentMediaBundle {
  /** Médias par content_item_id, déjà triés par position. */
  byItem: Map<string, MediaAsset[]>
  /** URL de couverture par content_item_id (Reel avec cover dédiée). */
  coverByItem: Map<string, string>
}

/**
 * Charge les médias de N contenus en 3 requêtes (liaisons, assets, covers),
 * jamais une requête par contenu.
 *
 * Le scope explicite est `client_id`, PAS `org_id` : un client appartient à
 * exactement une org (UNIQUE(id, org_id) + FK composites), donc filtrer par
 * client est au moins aussi fort — et ça reste correct pour un Reviewer, qui
 * n'a pas d'org active et peut être membre de clients de plusieurs orgs.
 */
export async function loadContentMedia(
  clientIds: string[],
  itemIds: string[],
  coverIdByItem: Map<string, string>
): Promise<ContentMediaBundle> {
  const empty: ContentMediaBundle = { byItem: new Map(), coverByItem: new Map() }
  if (itemIds.length === 0 || clientIds.length === 0) return empty

  const supabase = await createClient()

  const { data: links } = await supabase
    .from("content_media")
    .select("content_item_id, media_asset_id, position, alt_text_override")
    .in("client_id", clientIds)
    .in("content_item_id", itemIds)
    .order("position", { ascending: true })

  const linkRows = links ?? []
  const coverIds = [...new Set(coverIdByItem.values())]
  const wantedAssetIds = [...new Set([...linkRows.map((l) => l.media_asset_id), ...coverIds])]
  if (wantedAssetIds.length === 0) return empty

  const { data: assets } = await supabase
    .from("media_assets")
    .select(ASSET_COLUMNS)
    .in("client_id", clientIds)
    .in("id", wantedAssetIds)

  const assetRows = (assets ?? []) as AssetRow[]
  const byId = new Map(assetRows.map((row) => [row.id, row]))
  const urls = await makeMediaUrlResolver(assetRows.map((row) => row.storage_path))

  const byItem = new Map<string, MediaAsset[]>()
  for (const link of linkRows) {
    const row = byId.get(link.media_asset_id)
    if (!row) continue
    const alt = link.alt_text_override ?? row.alt_text
    const list = byItem.get(link.content_item_id) ?? []
    list.push({
      // L'id exposé est celui de l'ASSET : c'est la clé sur laquelle les
      // annotations du portail sont résolues (cf. getComments).
      id: row.id,
      type: row.type as MediaType,
      thumbUrl: urls.thumbUrl(row.thumb_path),
      fullUrl: urls.fullUrl(row.storage_path, row.thumb_path),
      width: row.width ?? 0,
      height: row.height ?? 0,
      durationSec: row.duration_ms != null ? Math.round(row.duration_ms / 1000) : undefined,
      position: link.position,
      altText: alt ? alt : undefined,
      fileSizeMb:
        row.byte_size != null ? Math.round((row.byte_size / (1024 * 1024)) * 10) / 10 : undefined,
      mimeType: row.mime_type ?? undefined,
    })
    byItem.set(link.content_item_id, list)
  }

  const coverByItem = new Map<string, string>()
  for (const [itemId, assetId] of coverIdByItem) {
    const row = byId.get(assetId)
    if (row) coverByItem.set(itemId, urls.thumbUrl(row.thumb_path))
  }

  return { byItem, coverByItem }
}
