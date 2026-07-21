"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "./_helpers"

// Agenda (migration 015). Les agendas sont scopés par UTILISATEUR : on ne passe
// pas par getActiveOrg/requireClientInOrg (qui raisonnent client), la RLS
// (user_id = auth.uid() AND is_org_member) fait l'autorisation.

const toggleSchema = z.object({
  calendarId: z.string().uuid(),
  enabled: z.boolean(),
})

/**
 * Persiste le toggle d'affichage d'un calendrier. C'était jusqu'ici un
 * useState perdu au rechargement. Seule la colonne is_enabled est écrivable
 * (grant colonne) : le nom et la couleur viennent du provider.
 */
export async function toggleCalendar(input: unknown): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { calendarId, enabled } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("calendar_calendars")
    .update({ is_enabled: enabled })
    .eq("id", calendarId)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/agenda")
  revalidatePath("/dashboard")
  return { ok: true }
}
