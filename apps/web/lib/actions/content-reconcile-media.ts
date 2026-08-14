import "server-only"

import type { requireClientInOrg } from "./_helpers"
import type { ReconcileError } from "./content-reconcile"

// Réconciliation des liaisons médias d'un contenu. Séparée des cibles et des
// étiquettes parce qu'elle est la seule des trois à devoir composer avec trois
// contraintes qui se gênent : un trigger de cardinalité, un unique deferrable sur
// la position, et des annotations client qui cascadent sur l'id de liaison.
//
// Le motif d'origine était delete-all + insert-all. Il recréait les liaisons avec
// de NOUVEAUX id, or `content_comments.annotation_content_media_id` cascade
// dessus (013:138) : les commentaires ANNOTÉS du client étaient supprimés — la
// ligne entière, pas seulement son ancre. Réconcilier par diff, c'est d'abord
// préserver ces id.

type Db = Awaited<ReturnType<typeof requireClientInOrg>>["supabase"]

export interface ReconcileMediaInput {
  libraryAssetId: string
  altText: string
  crop?: string
}

/**
 * Liaisons médias.
 *
 * L'identité d'une liaison est (asset, n-ième occurrence) : `content_media` n'a
 * VOLONTAIREMENT pas de `unique(content_item_id, media_asset_id)` (012:111), un
 * même asset peut apparaître deux fois dans un carrousel.
 *
 * L'ordre des opérations n'est pas décoratif :
 *   1. supprimer d'abord — sinon le trigger de cardinalité (post = 1 média)
 *      refuserait l'insertion du remplaçant ;
 *   2. insérer au-delà de la position maximale — `unique(content_item_id,
 *      position)` est deferrable mais chaque requête PostgREST est sa propre
 *      transaction, donc les collisions transitoires ne sont PAS tolérées ici ;
 *   3. réordonner via la RPC `reorder_content_media`, qui écrit toutes les
 *      positions en UNE transaction (c'est exactement ce pour quoi elle existe).
 */
export async function reconcileMedia(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  media: ReconcileMediaInput[]
): Promise<ReconcileError> {
  const { data: existing, error: readError } = await supabase
    .from("content_media")
    .select("id, media_asset_id, position, alt_text_override, crop_preset")
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)
    .order("position")
  if (readError) return readError.message

  const pool = new Map<string, string[]>()
  for (const link of existing ?? []) {
    const list = pool.get(link.media_asset_id) ?? []
    list.push(link.id)
    pool.set(link.media_asset_id, list)
  }

  // Appariement dans l'ordre voulu : la n-ième occurrence d'un asset reprend la
  // n-ième liaison existante, donc son id — donc ses annotations.
  const matched: (string | null)[] = media.map((m) => pool.get(m.libraryAssetId)?.shift() ?? null)
  const reused = new Set(matched.filter((id): id is string => id !== null))
  const obsolete = (existing ?? []).map((l) => l.id).filter((id) => !reused.has(id))

  if (obsolete.length) {
    const { error } = await supabase.from("content_media").delete().in("id", obsolete)
    if (error) return error.message
  }

  const maxPosition = Math.max(-1, ...(existing ?? []).map((l) => l.position))
  const created: string[] = []
  const toInsert = media
    .map((m, index) => ({ m, index }))
    .filter(({ index }) => matched[index] === null)
  if (toInsert.length) {
    const { data: inserted, error } = await supabase
      .from("content_media")
      .insert(
        toInsert.map(({ m }, offset) => ({
          org_id: orgId,
          client_id: clientId,
          content_item_id: contentId,
          media_asset_id: m.libraryAssetId,
          position: maxPosition + 1 + offset,
          alt_text_override: m.altText || null,
          crop_preset: m.crop ?? null,
        }))
      )
      .select("id")
    if (error) return error.message
    for (const row of inserted ?? []) created.push(row.id)
    toInsert.forEach(({ index }, offset) => {
      matched[index] = created[offset] ?? null
    })
  }

  // Alt et recadrage des liaisons conservées : mis à jour seulement s'ils ont
  // réellement changé (ne pas réécrire pour rien).
  const byId = new Map((existing ?? []).map((l) => [l.id, l]))
  for (const [index, id] of matched.entries()) {
    const link = id ? byId.get(id) : undefined
    const wanted = media[index]
    if (!link || !wanted) continue
    const alt = wanted.altText || null
    const crop = wanted.crop ?? null
    if (link.alt_text_override === alt && link.crop_preset === crop) continue
    const { error } = await supabase
      .from("content_media")
      .update({ alt_text_override: alt, crop_preset: crop })
      .eq("id", link.id)
    if (error) return error.message
  }

  const ordered = matched.filter((id): id is string => id !== null)
  if (ordered.length) {
    const { error } = await supabase.rpc("reorder_content_media", {
      _content_item: contentId,
      _ordered_media_ids: ordered,
    })
    if (error) return error.message
  }
  return null
}
