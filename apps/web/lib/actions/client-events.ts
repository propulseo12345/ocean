"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

const addSchema = z.object({
  clientId: z.string().uuid(),
  // Jour dans le fuseau du client (DATE, jamais un instant).
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  // Enum SQL public.client_event_kind.
  kind: z.enum(["note", "event"]).default("note"),
})

/** Ajoute une note ou un événement au calendrier éditorial. Renvoie l'id créé. */
export async function addClientEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, eventDate, title, kind } = parsed.data

  try {
    const { orgId, userId, supabase } = await requireClientInOrg(clientId)
    const { data, error } = await supabase
      .from("client_events")
      .insert({
        org_id: orgId,
        client_id: clientId,
        event_date: eventDate,
        title,
        kind,
        created_by: userId,
      })
      .select("id")
      .single()
    if (error || !data) return { ok: false, error: "db_error" }
    revalidatePath(`/clients/${clientId}/calendar`)
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const deleteSchema = z.object({
  clientId: z.string().uuid(),
  eventId: z.string().uuid(),
})

/** Supprime une note/événement client. */
export async function deleteClientEvent(input: unknown): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, eventId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("client_events")
      .delete()
      .eq("id", eventId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/calendar`)
  return { ok: true }
}
