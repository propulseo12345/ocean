"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { extractHashtags } from "@/lib/caption"
import { routes } from "@/lib/routes"
import type { ActionResult } from "./_helpers"
import { requireClientInOrg } from "./_helpers"

// Écritures CŒUR du contenu (Phase 8) : création/édition depuis le composer,
// programmation, corbeille. Le pendant « écriture » des lectures de content.ts.
//
// Invariants tenus côté DB (on s'appuie dessus, défense en profondeur en plus) :
// - un contenu NAÎT en 'idea' ou 'draft' (policy INSERT 006) ; le composer ne
//   propose que ces deux états — jamais 'published' par ce chemin.
// - la garde 008 refuse toute transition de statut illégale ; on ne touche au
//   statut QUE via l'état idea/draft du composer (les autres transitions passent
//   par applyStatusIntent, content-status.ts).
// - la cardinalité des médias (post/story=1, reel=1 vidéo, carousel≤10) et le
//   compteur de commentaires sont des triggers : on ne les réimplémente pas.

const MANUAL_PLATFORMS = ["newsletter", "custom"] as const

const mediaSchema = z.object({
  // Seuls les médias adossés à un asset de médiathèque sont persistables : un
  // média fraîchement uploadé dans le composer n'existe pas encore en base
  // (upload TUS non câblé). Ceux-là sont ignorés silencieusement au save.
  libraryAssetId: z.string().uuid(),
  altText: z.string().trim().max(1000).optional().default(""),
  crop: z.enum(["1:1", "4:5", "9:16"]).optional(),
})

const draftPayloadSchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid().optional(),
  title: z.string().trim().max(200),
  format: z.enum(["post", "carousel", "reel", "story"]),
  state: z.enum(["idea", "draft"]),
  pillarId: z.string().uuid().nullable().default(null),
  caption: z.string().max(10000),
  captionOverrides: z.record(z.string(), z.string().max(10000)).default({}),
  firstComment: z.string().trim().max(2200).default(""),
  media: z.array(mediaSchema).max(10).default([]),
  accountIds: z.array(z.string().uuid()).default([]),
  manualPlatforms: z.array(z.enum(MANUAL_PLATFORMS)).default([]),
  newsletterSubject: z.string().trim().max(300).default(""),
  internalNotes: z.string().trim().max(5000).default(""),
  labels: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  scheduledAt: z.string().datetime().nullable().default(null),
  igLocation: z.string().trim().max(200).default(""),
  fbLink: z.string().trim().url().max(2000).or(z.literal("")).default(""),
})

export type SaveContentPayload = z.input<typeof draftPayloadSchema>

/** Retire le bloc de hashtags de la légende (le modèle les stocke à part). */
function splitCaption(full: string): { caption: string; hashtags: string[] } {
  const hashtags = extractHashtags(full).map((h) => h.replace(/^#/, ""))
  // Convention du seed et de draftFromContent : content_items.caption ne
  // contient PAS les hashtags (réinjectés à l'édition), hashtags[] les porte.
  const caption = full
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return { caption, hashtags }
}

/** Statuts où l'on peut encore reconstruire cibles et médias sans risque. */
const RECONCILABLE_STATUSES = ["idea", "draft", "changes_requested"]

/**
 * Crée ou met à jour un contenu depuis le composer.
 *
 * Création : le contenu naît en idea/draft (état du composer). Édition : les
 * champs sont mis à jour ; le STATUT n'est pas modifié ici (sauf bascule
 * idea↔draft, seule autorisée par la garde depuis ces états) — les vraies
 * transitions passent par applyStatusIntent. Cibles/médias/étiquettes ne sont
 * reconstruits que tant que le contenu est en amont de la revue.
 */
export async function saveContentItem(
  input: SaveContentPayload
): Promise<ActionResult<{ id: string }>> {
  const parsed = draftPayloadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const d = parsed.data

  const { orgId, userId, supabase } = await requireClientInOrg(d.clientId)

  const { caption, hashtags } = splitCaption(d.caption)
  const platformOptions: Record<string, string> = {}
  if (d.igLocation) platformOptions.ig_location = d.igLocation
  if (d.fbLink) platformOptions.fb_link = d.fbLink

  const baseFields = {
    title: d.title || null,
    caption: caption || null,
    hashtags,
    format: d.format,
    pillar_id: d.pillarId,
    first_comment: d.firstComment || null,
    newsletter_subject: d.newsletterSubject || null,
    internal_notes: d.internalNotes || null,
    scheduled_at: d.scheduledAt,
    platform_options: platformOptions,
    updated_by: userId,
  }

  // --- Création ------------------------------------------------------------
  let contentId = d.contentId
  let currentStatus = d.state as string
  if (!contentId) {
    const { data, error } = await supabase
      .from("content_items")
      .insert({ ...baseFields, org_id: orgId, client_id: d.clientId, status: d.state })
      .select("id, status")
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? "INSERT_FAILED" }
    contentId = data.id
    currentStatus = data.status
  } else {
    // Vérifie l'appartenance + lit le statut courant.
    const { data: existing } = await supabase
      .from("content_items")
      .select("status")
      .eq("org_id", orgId)
      .eq("client_id", d.clientId)
      .eq("id", contentId)
      .maybeSingle()
    if (!existing) return { ok: false, error: "NOT_FOUND" }
    currentStatus = existing.status

    // Bascule idea↔draft autorisée par la garde depuis ces états ; sinon on ne
    // touche pas au statut (l'édition d'un contenu en revue reste possible mais
    // ne le rétrograde pas — le trigger approval_stale s'en charge si besoin).
    const statusPatch =
      currentStatus === "idea" || currentStatus === "draft" ? { status: d.state } : {}

    const { error } = await supabase
      .from("content_items")
      .update({ ...baseFields, ...statusPatch })
      .eq("org_id", orgId)
      .eq("client_id", d.clientId)
      .eq("id", contentId)
    if (error) return { ok: false, error: error.message }
  }

  // --- Cibles, médias, étiquettes (reconstruits en amont de la revue) ------
  if (RECONCILABLE_STATUSES.includes(currentStatus)) {
    await reconcileTargets(supabase, orgId, d.clientId, contentId, d.accountIds, d.manualPlatforms)
    await reconcileMedia(supabase, orgId, d.clientId, contentId, d.media)
  }
  // Les étiquettes sont éditables à tout statut (métadonnée interne).
  await reconcileLabels(supabase, orgId, d.clientId, contentId, d.labels)

  revalidatePath(routes.clientContent(d.clientId))
  revalidatePath(routes.content(d.clientId, contentId))
  return { ok: true, data: { id: contentId } }
}

type Db = Awaited<ReturnType<typeof requireClientInOrg>>["supabase"]

/** Remplace les cibles : comptes sociaux + plateformes manuelles. */
async function reconcileTargets(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  accountIds: string[],
  manualPlatforms: readonly string[]
) {
  // Résoudre la plateforme de chaque compte social (défense : le compte doit
  // appartenir au client).
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, platform")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
  const platformById = new Map((accounts ?? []).map((a) => [a.id, a.platform]))

  const rows = [
    ...accountIds
      .filter((id) => platformById.has(id))
      .map((id) => ({
        org_id: orgId,
        client_id: clientId,
        content_item_id: contentId,
        social_account_id: id,
        platform: platformById.get(id) as string,
      })),
    ...manualPlatforms.map((platform) => ({
      org_id: orgId,
      client_id: clientId,
      content_item_id: contentId,
      social_account_id: null,
      platform,
    })),
  ]

  // Delete+insert : sûr tant que les cibles sont 'pending' (statut pré-revue).
  await supabase
    .from("content_targets")
    .delete()
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)
  if (rows.length) await supabase.from("content_targets").insert(rows)
}

/** Remplace les liaisons médias (assets de médiathèque uniquement). */
async function reconcileMedia(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  media: { libraryAssetId: string; altText: string; crop?: string }[]
) {
  await supabase.from("content_media").delete().eq("org_id", orgId).eq("content_item_id", contentId)
  if (!media.length) return

  const rows = media.map((m, position) => ({
    org_id: orgId,
    client_id: clientId,
    content_item_id: contentId,
    media_asset_id: m.libraryAssetId,
    position,
    alt_text_override: m.altText || null,
    crop_preset: m.crop ?? null,
  }))
  await supabase.from("content_media").insert(rows)
}

/** Upsert des étiquettes par nom puis reconstruction des liaisons. */
async function reconcileLabels(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  labels: string[]
) {
  await supabase
    .from("content_item_labels")
    .delete()
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)
  if (!labels.length) return

  const wanted = [...new Set(labels)]
  const { data: existing } = await supabase
    .from("content_labels")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("name", wanted)
  const idByName = new Map((existing ?? []).map((l) => [l.name, l.id]))

  const toCreate = wanted.filter((name) => !idByName.has(name))
  if (toCreate.length) {
    const { data: created } = await supabase
      .from("content_labels")
      .insert(toCreate.map((name) => ({ org_id: orgId, client_id: clientId, name })))
      .select("id, name")
    for (const l of created ?? []) idByName.set(l.name, l.id)
  }

  const links = wanted
    .map((name) => idByName.get(name))
    .filter((id): id is string => id !== undefined)
    .map((content_label_id) => ({
      org_id: orgId,
      client_id: clientId,
      content_item_id: contentId,
      content_label_id,
    }))
  if (links.length) await supabase.from("content_item_labels").insert(links)
}

// --- Programmation / corbeille ---------------------------------------------

const scheduleSchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid(),
  scheduledAt: z.string().datetime().nullable(),
})

/**
 * Fixe (ou retire) la date de programmation d'un contenu. Ne change PAS le
 * statut : programmer un contenu (draft/approved → scheduled) passe par
 * applyStatusIntent. Ici on ne fait que déplacer la date d'un contenu déjà
 * daté (drag calendrier) ou dé-programmer.
 */
export async function scheduleContentItem(
  input: z.infer<typeof scheduleSchema>
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId, scheduledAt } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)
  const { error } = await supabase
    .from("content_items")
    .update({ scheduled_at: scheduledAt })
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("id", contentId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.content(clientId, contentId))
  revalidatePath(routes.clientContent(clientId))
  return { ok: true }
}

const trashSchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid(),
})

/** Soft-delete : dépose le contenu dans la corbeille (restaurable). */
export async function trashContent(input: z.infer<typeof trashSchema>): Promise<ActionResult> {
  const parsed = trashSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)
  const { error } = await supabase
    .from("content_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("id", contentId)
    .is("deleted_at", null)
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.clientContent(clientId))
  return { ok: true }
}

/** Restaure un contenu depuis la corbeille. */
export async function restoreContent(input: z.infer<typeof trashSchema>): Promise<ActionResult> {
  const parsed = trashSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)
  const { error } = await supabase
    .from("content_items")
    .update({ deleted_at: null })
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("id", contentId)
    .not("deleted_at", "is", null)
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.clientContent(clientId))
  return { ok: true }
}
