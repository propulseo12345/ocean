"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

// Server Actions médiathèque (migration 012). Le fichier binaire transite par le
// client Supabase du navigateur (TUS 6 Mo vers media-originals, vignette WebP
// vers media-thumbs) ; ces actions n'écrivent que les LIGNES en base une fois
// les chemins Storage connus. Aucune URL n'est stockée (thumbUrl/fullUrl sont
// dérivées à la lecture : getPublicUrl / createSignedUrl).

const mediaType = z.enum(["image", "video"])
const mediaSource = z.enum(["upload", "depot_client", "import"])
const cropPreset = z.enum(["1:1", "4:5", "9:16"])

const recordSchema = z.object({
  clientId: z.string().uuid(),
  type: mediaType,
  storagePath: z.string().min(1).max(1024),
  thumbPath: z.string().min(1).max(1024).nullable().optional(),
  mimeType: z.string().max(255).nullable().optional(),
  byteSize: z.number().int().positive().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationMs: z.number().int().positive().nullable().optional(),
  fileName: z.string().max(512).nullable().optional(),
  altText: z.string().max(1000).nullable().optional(),
  source: mediaSource.default("upload"),
})

/**
 * Enregistre un asset dont le fichier a déjà été téléversé dans Storage.
 * Renvoie l'id créé (référencé ensuite par content_media / les annotations).
 */
export async function recordUploadedAsset(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = recordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const d = parsed.data

  // Cohérence type/vidéo : duration réservée à la vidéo (miroir du check SQL).
  if (d.type === "image" && d.durationMs != null) {
    return { ok: false, error: "duration_on_image" }
  }

  try {
    const { orgId, userId, supabase } = await requireClientInOrg(d.clientId)
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        org_id: orgId,
        client_id: d.clientId,
        type: d.type,
        storage_path: d.storagePath,
        thumb_path: d.thumbPath ?? null,
        mime_type: d.mimeType ?? null,
        byte_size: d.byteSize ?? null,
        width: d.width ?? null,
        height: d.height ?? null,
        duration_ms: d.durationMs ?? null,
        file_name: d.fileName ?? null,
        alt_text: d.altText ?? null,
        source: d.source,
        uploaded_by: userId,
      })
      .select("id")
      .single()
    if (error || !data) return { ok: false, error: "db_error" }
    revalidatePath(`/clients/${d.clientId}/library`)
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const altSchema = z.object({
  clientId: z.string().uuid(),
  assetId: z.string().uuid(),
  altText: z.string().max(1000),
})

/** Met à jour le texte alternatif d'un asset (niveau médiathèque). */
export async function updateAssetAlt(input: unknown): Promise<ActionResult> {
  const parsed = altSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, assetId, altText } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("media_assets")
      .update({ alt_text: altText.trim() ? altText.trim() : null })
      .eq("id", assetId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/library`)
  return { ok: true }
}

const deleteSchema = z.object({
  clientId: z.string().uuid(),
  assetId: z.string().uuid(),
})

/**
 * Soft-delete d'un asset (deleted_at). Refusé s'il est encore rattaché à un
 * contenu (content_media) ou utilisé comme cover — l'utilisateur doit d'abord
 * le détacher (garde-fou DeleteAssetDialog, aligné sur les FK restrict).
 */
export async function deleteAsset(input: unknown): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, assetId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)

    const { count: usedCount } = await supabase
      .from("content_media")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("media_asset_id", assetId)
    if ((usedCount ?? 0) > 0) return { ok: false, error: "in_use" }

    const { count: coverCount } = await supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("cover_media_asset_id", assetId)
    if ((coverCount ?? 0) > 0) return { ok: false, error: "in_use_cover" }

    const { error } = await supabase
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", assetId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/library`)
  return { ok: true }
}

const attachSchema = z.object({
  clientId: z.string().uuid(),
  contentItemId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  position: z.number().int().min(0),
  altTextOverride: z.string().max(1000).nullable().optional(),
  cropPreset: cropPreset.nullable().optional(),
})

/** Attache un asset à un contenu à une position donnée. Renvoie l'id de liaison. */
export async function attachMedia(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = attachSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const {
    clientId,
    contentItemId,
    mediaAssetId,
    position,
    altTextOverride,
    cropPreset: crop,
  } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { data, error } = await supabase
      .from("content_media")
      .insert({
        org_id: orgId,
        client_id: clientId,
        content_item_id: contentItemId,
        media_asset_id: mediaAssetId,
        position,
        alt_text_override: altTextOverride ?? null,
        crop_preset: crop ?? null,
      })
      .select("id")
      .single()
    // 23514 = trigger de cardinalité (trop de slides / reel non-vidéo).
    if (error) return { ok: false, error: error.code === "23514" ? "cardinality" : "db_error" }
    if (!data) return { ok: false, error: "db_error" }
    revalidatePath(`/clients/${clientId}/content/${contentItemId}`)
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const detachSchema = z.object({
  clientId: z.string().uuid(),
  contentMediaId: z.string().uuid(),
  contentItemId: z.string().uuid(),
})

/** Détache un média d'un contenu (supprime la liaison, garde l'asset). */
export async function detachMedia(input: unknown): Promise<ActionResult> {
  const parsed = detachSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, contentMediaId, contentItemId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("content_media")
      .delete()
      .eq("id", contentMediaId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/content/${contentItemId}`)
  return { ok: true }
}

const reorderSchema = z.object({
  clientId: z.string().uuid(),
  contentItemId: z.string().uuid(),
  orderedMediaIds: z.array(z.string().uuid()).min(1),
})

/** Réordonne les médias d'un contenu (RPC atomique, unique deferrable). */
export async function reorderMedia(input: unknown): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, contentItemId, orderedMediaIds } = parsed.data

  try {
    const { supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.rpc("reorder_content_media", {
      _content_item: contentItemId,
      _ordered_media_ids: orderedMediaIds,
    })
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/content/${contentItemId}`)
  return { ok: true }
}
