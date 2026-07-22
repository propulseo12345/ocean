"use server"

import { createHash, randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"

import { sendTransactional } from "@/lib/brevo/transactional"
import { routes } from "@/lib/routes"
import { createClient } from "@/lib/supabase/server"
import { type ActionResult, requireClientInOrg } from "./_helpers"

// Collaboration & validation (migration 013). Deux publics : l'owner (routes
// (app), org member) ET le reviewer (portail, membre de client uniquement, PAS
// d'org active). Les actions du portail s'appuient sur la session + la RLS/RPC
// pour l'autorisation, jamais sur getActiveOrg (qui redirige un reviewer).

/** Résout org_id/client_id d'un contenu visible par l'appelant (RLS-filtré). */
async function contentContext(contentItemId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("content_items")
    .select("org_id, client_id")
    .eq("id", contentItemId)
    .maybeSingle()
  if (!data) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()
  return {
    supabase,
    userId: user.id,
    orgId: data.org_id,
    clientId: data.client_id,
    name: profile?.full_name ?? profile?.email ?? null,
  }
}

const decisionSchema = z.object({
  contentItemId: z.string().uuid(),
  decision: z.enum(["approved", "changes_requested"]),
  message: z.string().max(2000).nullable().optional(),
})

/** Décision de validation du reviewer (portail). Passe par la RPC (B1). */
export async function submitReviewDecision(input: unknown): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { contentItemId, decision, message } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthorized" }

  const { error } = await supabase.rpc("submit_review_decision", {
    _content_item: contentItemId,
    _decision: decision,
    _message: message ?? null,
  })
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/portal")
  return { ok: true }
}

const commentSchema = z.object({
  contentItemId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  visibility: z.enum(["client", "internal"]).default("client"),
  annotation: z
    .object({
      contentMediaId: z.string().uuid(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
})

/**
 * Poste un commentaire (fil client ou note interne). La RLS tranche : un
 * reviewer ne peut écrire que 'client' sous son identité sur un contenu visible ;
 * l'owner écrit les deux couches. author_role dérivé de l'appartenance org.
 */
export async function postComment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { contentItemId, body, visibility, annotation } = parsed.data

  const ctx = await contentContext(contentItemId)
  if (!ctx) return { ok: false, error: "forbidden" }

  // author_role : owner si membre de l'org, sinon reviewer.
  const { data: orgMember } = await ctx.supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle()
  const authorRole = orgMember ? "owner" : "reviewer"

  const { data, error } = await ctx.supabase
    .from("content_comments")
    .insert({
      org_id: ctx.orgId,
      client_id: ctx.clientId,
      content_item_id: contentItemId,
      author_user_id: ctx.userId,
      author_name: ctx.name,
      author_role: authorRole,
      visibility,
      body,
      annotation_content_media_id: annotation?.contentMediaId ?? null,
      annotation_x: annotation?.x ?? null,
      annotation_y: annotation?.y ?? null,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: "db_error" }

  revalidatePath(`/clients/${ctx.clientId}/content/${contentItemId}`)
  revalidatePath("/portal")
  return { ok: true, data: { id: data.id } }
}

const resolveSchema = z.object({
  contentItemId: z.string().uuid(),
  commentId: z.string().uuid(),
  resolved: z.boolean(),
})

/**
 * Marque (ou rouvre) un retour client comme « résolu ». Owner-only : la policy
 * UPDATE de content_comments exige is_org_member, et le grant restreint les
 * colonnes éditables à (resolved_at, resolved_by, deleted_at) — l'owner ne
 * réécrit jamais le body d'un retour client. On vérifie l'appartenance org en
 * amont pour renvoyer une erreur nette plutôt qu'un update silencieux à 0 ligne.
 */
export async function toggleCommentResolved(input: unknown): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { contentItemId, commentId, resolved } = parsed.data

  const ctx = await contentContext(contentItemId)
  if (!ctx) return { ok: false, error: "forbidden" }

  const { data: orgMember } = await ctx.supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle()
  if (!orgMember) return { ok: false, error: "forbidden" }

  const { error } = await ctx.supabase
    .from("content_comments")
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? ctx.userId : null,
    })
    .eq("org_id", ctx.orgId)
    .eq("client_id", ctx.clientId)
    .eq("id", commentId)
  if (error) return { ok: false, error: "db_error" }

  revalidatePath(`/clients/${ctx.clientId}/content/${contentItemId}`)
  return { ok: true }
}

const reviewRequestSchema = z.object({
  clientId: z.string().uuid(),
  contentItemIds: z.array(z.string().uuid()).min(1),
  recipientUserIds: z.array(z.string().uuid()).min(1),
  message: z.string().max(2000).nullable().optional(),
})

/** Envoie un lot de contenus en validation (owner). Crée requête + items + destinataires. */
export async function sendReviewRequest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = reviewRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, contentItemIds, recipientUserIds, message } = parsed.data

  try {
    const { orgId, userId, supabase } = await requireClientInOrg(clientId)
    const { data: request, error } = await supabase
      .from("review_requests")
      .insert({ org_id: orgId, client_id: clientId, message: message ?? null, sent_by: userId })
      .select("id")
      .single()
    if (error || !request) return { ok: false, error: "db_error" }

    const items = contentItemIds.map((id) => ({
      org_id: orgId,
      client_id: clientId,
      review_request_id: request.id,
      content_item_id: id,
    }))
    const recipients = recipientUserIds.map((id) => ({
      org_id: orgId,
      client_id: clientId,
      review_request_id: request.id,
      recipient_user_id: id,
    }))
    const [{ error: itemsError }, { error: recError }] = await Promise.all([
      supabase.from("review_request_items").insert(items),
      supabase.from("review_request_recipients").insert(recipients),
    ])
    if (itemsError || recError) return { ok: false, error: "db_error" }

    revalidatePath(`/clients/${clientId}/content`)
    return { ok: true, data: { id: request.id } }
  } catch {
    return { ok: false, error: "forbidden" }
  }
}

const remindSchema = z.object({
  clientId: z.string().uuid(),
  reviewRequestId: z.string().uuid(),
})

/** Relance un lot de validation (owner) — incrémente reminder_count. */
export async function remindReviewer(input: unknown): Promise<ActionResult> {
  const parsed = remindSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, reviewRequestId } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { data: current } = await supabase
      .from("review_requests")
      .select("reminder_count")
      .eq("id", reviewRequestId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .maybeSingle()
    if (!current) return { ok: false, error: "not_found" }

    const { error } = await supabase
      .from("review_requests")
      .update({
        reminder_count: current.reminder_count + 1,
        last_reminded_at: new Date().toISOString(),
      })
      .eq("id", reviewRequestId)
      .eq("org_id", orgId)
      .eq("client_id", clientId)
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/content`)
  return { ok: true }
}

const inviteSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email().max(320),
})

/**
 * Invite un reviewer (owner). Crée un client_invitations avec un token hashé ;
 * renvoie le token EN CLAIR une seule fois (pour l'URL de l'email Brevo). Le
 * hash seul vit en base ; l'acceptation passe par un Route Handler service_role.
 */
export async function inviteReviewer(input: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, email } = parsed.data
  const normalizedEmail = email.trim().toLowerCase()

  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { orgId, userId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.from("client_invitations").insert({
      org_id: orgId,
      client_id: clientId,
      email: normalizedEmail,
      role: "reviewer",
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: userId,
    })
    // 23505 = invitation en cours déjà existante pour cet email + client.
    if (error) return { ok: false, error: error.code === "23505" ? "already_invited" : "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  // Email d'invitation — BEST-EFFORT (Tier D). Sans Brevo configuré,
  // sendTransactional lève et on ignore : l'invitation reste valide et le lien
  // d'acceptation est affiché dans l'UI. Auto-actif dès que Brevo est câblé.
  try {
    const h = await headers()
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
    await sendTransactional({
      template: "reviewer-invitation",
      to: normalizedEmail,
      params: { accept_url: `${origin}${routes.acceptInvite(token)}` },
      tags: ["reviewer-invitation"],
    })
  } catch {
    // ignore (scaffolding inerte sans secrets)
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true, data: { token } }
}
