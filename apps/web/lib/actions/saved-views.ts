"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

// Enums SQL (content_status, platform, content_format) — calés côté DB, plus
// stricts que les types front. Les filtres d'étiquettes/piliers sont des uuid[].
const contentStatus = z.enum([
  "idea",
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
  "canceled",
])
const platform = z.enum(["instagram", "facebook", "tiktok", "newsletter", "custom"])
const contentFormat = z.enum(["post", "carousel", "reel", "story"])

const saveSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  filters: z.object({
    search: z.string().max(200).optional(),
    statuses: z.array(contentStatus).optional(),
    platforms: z.array(platform).optional(),
    formats: z.array(contentFormat).optional(),
    pillarIds: z.array(z.string().uuid()).optional(),
    labelIds: z.array(z.string().uuid()).optional(),
  }),
})

/** Enregistre une vue filtrée du board (scope client + propriétaire courant). */
export async function saveView(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, name, filters } = parsed.data

  try {
    const { orgId, userId, supabase } = await requireClientInOrg(clientId)
    const { data, error } = await supabase
      .from("saved_views")
      .insert({
        org_id: orgId,
        client_id: clientId,
        owner_user_id: userId,
        name,
        search: filters.search ?? null,
        statuses: filters.statuses ?? [],
        platforms: filters.platforms ?? [],
        formats: filters.formats ?? [],
        pillar_ids: filters.pillarIds ?? [],
        label_ids: filters.labelIds ?? [],
      })
      .select("id")
      .single()
    if (error || !data) return { ok: false, error: "db_error" }
    revalidatePath(`/clients/${clientId}/content`)
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const deleteSchema = z.object({
  clientId: z.string().uuid(),
  viewId: z.string().uuid(),
})

/** Supprime une vue enregistrée (la RLS garantit qu'elle appartient au user). */
export async function deleteView(input: unknown): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, viewId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("saved_views")
      .delete()
      .eq("id", viewId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/content`)
  return { ok: true }
}
