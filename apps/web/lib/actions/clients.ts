"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getActiveOrg } from "@/lib/auth/org-context"
import { createClient } from "@/lib/supabase/server"
import { type ActionResult, requireClientInOrg } from "./_helpers"
import { inviteReviewer } from "./collaboration"

// Création d'un client (wizard d'onboarding). Contrairement aux autres actions,
// le client n'existe pas encore : on ne passe donc pas par requireClientInOrg,
// mais par getActiveOrg + contrôle de rôle, puis on INJECTE org_id (règle 7).
// Le cœur (ligne clients) est critique ; les sous-entités (piliers, créneaux,
// brand kit) sont best-effort — leur échec n'annule pas la création du client.

const publishablePlatform = z.enum(["instagram", "facebook", "tiktok"])

const draftSchema = z.object({
  name: z.string().trim().min(2).max(120),
  handle: z.string().trim().max(80).default(""),
  category: z.string().trim().max(80).default(""),
  bio: z.string().trim().max(2000).default(""),
  timezone: z.string().trim().min(1).max(64).default("Europe/Paris"),
  brandColor: z.string().trim().max(64).default(""),
  approvalMode: z.enum(["auto", "optional", "required"]).default("required"),
  palette: z.array(z.string().max(64)).max(12).default([]),
  tone: z.string().max(2000).default(""),
  doList: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  dontList: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  bannedWords: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  pillars: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        colorVar: z.string().max(64).default(""),
        targetShare: z.number().min(0).max(100).default(0),
      })
    )
    .max(12)
    .default([]),
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        platforms: z.array(publishablePlatform),
      })
    )
    .max(50)
    .default([]),
  reviewerEmail: z.string().trim().max(320).default(""),
})

// "var(--chart-3)" | "chart-3" -> "chart-3" (miroir du CHECK color_token chart-1..5).
function toColorToken(value: string): "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" {
  const m = /chart-([1-5])/.exec(value)
  return (m ? `chart-${m[1]}` : "chart-1") as "chart-1"
}

// Handle stocké en minuscules (CHECK handle = lower(handle)), caractères sûrs.
function normalizeHandle(value: string): string | null {
  const h = value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
  return h.length >= 1 ? h : null
}

/**
 * Crée un client dans l'org active et renvoie son id réel.
 * Nommée `createClientAction` pour ne pas masquer la factory `createClient`
 * de lib/supabase/server importée ci-dessus.
 */
export async function createClientAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const d = parsed.data

  const ctx = await getActiveOrg()
  if (!ctx) return { ok: false, error: "unauthorized" }
  if (!["owner", "admin"].includes(ctx.role)) return { ok: false, error: "forbidden" }

  const orgId = ctx.org.id
  const supabase = await createClient()

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      org_id: orgId,
      name: d.name,
      handle: normalizeHandle(d.handle),
      brand_color: d.brandColor || null,
      timezone: d.timezone,
      approval_mode: d.approvalMode,
      bio: d.bio || null,
      category: d.category || null,
    })
    .select("id")
    .single()

  if (error || !created) {
    // 23505 = violation de unique(org_id, handle) : handle déjà pris dans l'org.
    if (error?.code === "23505") return { ok: false, error: "handle_taken" }
    return { ok: false, error: "db_error" }
  }

  const clientId = created.id

  // --- Sous-entités best-effort (n'annulent pas la création du client) --------
  if (d.pillars.length > 0) {
    await supabase.from("content_pillars").insert(
      d.pillars.map((p, i) => ({
        org_id: orgId,
        client_id: clientId,
        name: p.name,
        color_token: toColorToken(p.colorVar),
        target_share: Math.round(p.targetShare),
        sort_order: i,
      }))
    )
  }

  const validSlots = d.slots.filter((s) => s.platforms.length > 0)
  if (validSlots.length > 0) {
    await supabase.from("recurring_slots").insert(
      validSlots.map((s) => ({
        org_id: orgId,
        client_id: clientId,
        weekday: s.weekday,
        time_of_day: `${s.time}:00`,
        platforms: s.platforms,
        pillar_id: null,
      }))
    )
  }

  const hasBrandKit =
    d.tone.trim().length > 0 ||
    d.doList.length > 0 ||
    d.dontList.length > 0 ||
    d.bannedWords.length > 0 ||
    d.palette.length > 0
  if (hasBrandKit) {
    await supabase.from("brand_kits").upsert(
      {
        client_id: clientId,
        org_id: orgId,
        palette: d.palette,
        tone: d.tone.trim() ? d.tone.trim() : null,
        do_list: d.doList,
        dont_list: d.dontList,
        banned_words: d.bannedWords,
      },
      { onConflict: "client_id" }
    )
  }

  // Invitation reviewer optionnelle (best-effort) : crée la ligne
  // client_invitations via inviteReviewer. L'ENVOI de l'email est différé
  // (Brevo, Tier D) ; ici on enregistre l'invitation (token hashé). Un email
  // invalide ou une invitation en double n'annule pas la création du client.
  if (d.reviewerEmail.trim()) {
    await inviteReviewer({ clientId, email: d.reviewerEmail.trim() })
  }

  revalidatePath("/clients", "layout")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: clientId } }
}

const updateSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  handle: z.string().trim().max(80).default(""),
  category: z.string().trim().max(80).default(""),
  bio: z.string().trim().max(2000).default(""),
  timezone: z.string().trim().min(1).max(64),
  brandColor: z.string().trim().max(64).default(""),
  notes: z.string().trim().max(4000).default(""),
})

/** Met à jour la fiche profil d'un client. */
export async function updateClientProfile(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const d = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(d.clientId)
    const { error } = await supabase
      .from("clients")
      .update({
        name: d.name,
        handle: normalizeHandle(d.handle),
        brand_color: d.brandColor || null,
        timezone: d.timezone,
        bio: d.bio || null,
        category: d.category || null,
        notes: d.notes || null,
      })
      .eq("id", d.clientId)
      .eq("org_id", orgId)
    if (error) return { ok: false, error: error.code === "23505" ? "handle_taken" : "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${d.clientId}/settings`)
  revalidatePath("/clients", "layout")
  return { ok: true }
}

const archiveSchema = z.object({
  clientId: z.string().uuid(),
  archived: z.boolean(),
})

/** Archive (archived_at = now()) ou réactive (null) un client. */
export async function setClientArchived(input: unknown): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, archived } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", clientId)
      .eq("org_id", orgId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  revalidatePath("/clients", "layout")
  revalidatePath("/dashboard")
  return { ok: true }
}

const deleteClientSchema = z.object({ clientId: z.string().uuid() })

/**
 * Supprime définitivement un client (cascade sur les tables filles via FK).
 * NB règle 23 : les fichiers Storage d'un client supprimé deviennent orphelins
 * jusqu'au passage de l'Edge Function media-cleanup (différée, Tier D). En phase
 * solo sur un client sans média, aucun orphelin.
 */
export async function deleteClientAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("org_id", orgId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath("/clients", "layout")
  revalidatePath("/dashboard")
  return { ok: true }
}
