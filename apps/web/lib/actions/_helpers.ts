import "server-only"

import { getActiveOrg } from "@/lib/auth/org-context"
import { createClient } from "@/lib/supabase/server"

// Socle des Server Actions (pattern CLAUDE.md §7). Chaque action :
//   getActiveOrg() en 1re ligne → vérifie l'appartenance du client à l'org →
//   Zod calé sur les enums SQL → injecte org_id → mute → revalidatePath.
// L'org_id vient TOUJOURS du serveur (cookie httpOnly validé), jamais du client.

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

/**
 * Contexte d'écriture scopé à un client. Valide que `clientId` appartient à
 * l'org active (défense en profondeur, en plus de la RLS + FK composites).
 * getActiveOrg redirige déjà si pas de session/org ; le rôle renvoyé est
 * owner|admin (un reviewer n'atteint jamais les routes (app)).
 *
 * Lève 'FORBIDDEN' si le client n'est pas dans l'org active.
 */
export async function requireClientInOrg(clientId: string) {
  const ctx = await getActiveOrg()
  const supabase = await createClient()
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", ctx.org.id)
    .maybeSingle()
  if (!client) throw new Error("FORBIDDEN")
  return { orgId: ctx.org.id, role: ctx.role, userId: ctx.user.id, supabase }
}
