"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getActiveOrg } from "@/lib/auth/org-context"
import { createClient } from "@/lib/supabase/server"
import { type ActionResult } from "./_helpers"

// Notifications : marquage lu. Les RPC sont SECURITY DEFINER scopées sur
// auth.uid() (migration 009) — le destinataire est déduit de la session, jamais
// passé par le client. On revalide le centre + le dashboard (badge cloche).

const idSchema = z.object({ id: z.string().uuid() })

/** Marque UNE notification comme lue (à l'ouverture). */
export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }

  const ctx = await getActiveOrg()
  if (!ctx) return { ok: false, error: "unauthorized" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("mark_notification_read", {
    _notification: parsed.data.id,
  })
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/notifications")
  revalidatePath("/dashboard")
  return { ok: true }
}

/** Marque TOUTES les notifications non lues du destinataire courant comme lues. */
export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  const ctx = await getActiveOrg()
  if (!ctx) return { ok: false, error: "unauthorized" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("mark_all_notifications_read")
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/notifications")
  revalidatePath("/dashboard")
  return { ok: true, data: { count: data ?? 0 } }
}
