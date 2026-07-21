"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

// Réglages cadence & relance (table client_settings, org-only — décision D4).
// Deux sections d'UI distinctes (Validation, Cadence) écrivent sur la même
// ligne : l'upsert ne porte QUE les colonnes de sa section, les autres restent
// intactes (ON CONFLICT DO UPDATE SET des seules colonnes fournies).

const cadenceSchema = z.object({
  clientId: z.string().uuid(),
  cadenceGapDays: z.number().int().min(2).max(21),
  cadenceMaxPerDay: z.number().int().min(1).max(6),
  cadenceAlerts: z.object({
    empty_week: z.boolean(),
    gap: z.boolean(),
    collision: z.boolean(),
  }),
})

/** Seuils et interrupteurs d'alerte de cadence. */
export async function updateCadence(input: unknown): Promise<ActionResult> {
  const parsed = cadenceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, cadenceGapDays, cadenceMaxPerDay, cadenceAlerts } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.from("client_settings").upsert(
      {
        client_id: clientId,
        org_id: orgId,
        cadence_gap_days: cadenceGapDays,
        cadence_max_per_day: cadenceMaxPerDay,
        cadence_alerts: cadenceAlerts,
      },
      { onConflict: "client_id" }
    )
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}

const approvalSchema = z.object({
  clientId: z.string().uuid(),
  // Enum SQL public.approval_mode (pas le type front, identique ici).
  mode: z.enum(["required", "optional", "auto"]),
  reminderDays: z.number().int().min(1).max(7),
})

/**
 * Mode de validation (clients.approval_mode) + délai de relance
 * (client_settings.review_reminder_days) — sauvegardés ensemble par la section
 * Validation. Deux tables, une intention utilisateur.
 */
export async function updateApprovalSettings(input: unknown): Promise<ActionResult> {
  const parsed = approvalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, mode, reminderDays } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)

    const { error: clientError } = await supabase
      .from("clients")
      .update({ approval_mode: mode })
      .eq("id", clientId)
      .eq("org_id", orgId)
    if (clientError) return { ok: false, error: "db_error" }

    const { error: settingsError } = await supabase.from("client_settings").upsert(
      {
        client_id: clientId,
        org_id: orgId,
        review_reminder_days: reminderDays,
      },
      { onConflict: "client_id" }
    )
    if (settingsError) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}
