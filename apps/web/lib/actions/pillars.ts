"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { Database } from "@/lib/supabase/types"
import { type ActionResult, requireClientInOrg } from "./_helpers"

type PillarUpdate = Database["public"]["Tables"]["content_pillars"]["Update"]

// Tokens de thème autorisés (miroir du check SQL chart-1..chart-5).
const colorToken = z.enum(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"])

const createSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  colorToken: colorToken.default("chart-1"),
  targetShare: z.number().int().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).default(0),
})

/** Crée un pilier éditorial. Renvoie l'id créé. */
export async function createPillar(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, name, colorToken: token, targetShare, sortOrder } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { data, error } = await supabase
      .from("content_pillars")
      .insert({
        org_id: orgId,
        client_id: clientId,
        name,
        color_token: token,
        target_share: targetShare,
        sort_order: sortOrder,
      })
      .select("id")
      .single()
    if (error || !data) return { ok: false, error: "db_error" }
    revalidatePath(`/clients/${clientId}/settings`)
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const updateSchema = z.object({
  clientId: z.string().uuid(),
  pillarId: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  colorToken: colorToken.optional(),
  targetShare: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

/** Met à jour un pilier (nom, couleur, part cible, ordre). */
export async function updatePillar(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, pillarId, name, colorToken: token, targetShare, sortOrder } = parsed.data

  const patch: PillarUpdate = {}
  if (name !== undefined) patch.name = name
  if (token !== undefined) patch.color_token = token
  if (targetShare !== undefined) patch.target_share = targetShare
  if (sortOrder !== undefined) patch.sort_order = sortOrder
  if (Object.keys(patch).length === 0) return { ok: true }

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("content_pillars")
      .update(patch)
      .eq("id", pillarId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}

const archiveSchema = z.object({
  clientId: z.string().uuid(),
  pillarId: z.string().uuid(),
})

/**
 * Archive un pilier (suppression douce). Les contenus passés gardent leur
 * pilier et les parts historiques restent stables (archived_at, pas DELETE).
 */
export async function archivePillar(input: unknown): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, pillarId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("content_pillars")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", pillarId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}
