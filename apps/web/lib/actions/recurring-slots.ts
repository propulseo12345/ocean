"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

// Enum SQL restreint aux plateformes publiables (le check DB refuse le reste).
const publishablePlatform = z.enum(["instagram", "facebook", "tiktok"])

const addSchema = z.object({
  clientId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  platforms: z.array(publishablePlatform).min(1),
  pillarId: z.string().uuid().nullable().optional(),
})

/** Ajoute un créneau récurrent. Renvoie l'id créé pour l'UI optimiste. */
export async function addRecurringSlot(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, weekday, time, platforms, pillarId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { data, error } = await supabase
      .from("recurring_slots")
      .insert({
        org_id: orgId,
        client_id: clientId,
        weekday,
        time_of_day: `${time}:00`,
        platforms,
        pillar_id: pillarId ?? null,
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
  slotId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  platforms: z.array(publishablePlatform).min(1),
  pillarId: z.string().uuid().nullable().optional(),
})

/** Met à jour un créneau existant (jour, heure, plateformes, pilier). */
export async function updateRecurringSlot(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, slotId, weekday, time, platforms, pillarId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("recurring_slots")
      .update({
        weekday,
        time_of_day: `${time}:00`,
        platforms,
        pillar_id: pillarId ?? null,
      })
      .eq("id", slotId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}

const deleteSchema = z.object({
  clientId: z.string().uuid(),
  slotId: z.string().uuid(),
})

/** Supprime un créneau récurrent. */
export async function deleteRecurringSlot(input: unknown): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, slotId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("recurring_slots")
      .delete()
      .eq("id", slotId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}
