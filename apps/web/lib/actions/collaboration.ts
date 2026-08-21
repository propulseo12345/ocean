"use server"

import { createHash, randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { sendTransactional } from "@/lib/brevo/transactional"
import { notifyOrgMembers, siteOrigin } from "@/lib/notifications/notify-org"
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
    .select("org_id, client_id, title")
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
    title: data.title ?? "Publication sans titre",
    name: profile?.full_name ?? profile?.email ?? null,
  }
}

/** Extrait court d'un retour, pour le corps d'une notification / d'un email. */
function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
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

  const ctx = await contentContext(contentItemId)
  if (!ctx) return { ok: false, error: "forbidden" }

  const { error } = await ctx.supabase.rpc("submit_review_decision", {
    _content_item: contentItemId,
    _decision: decision,
    _message: message ?? null,
  })
  if (error) return { ok: false, error: "db_error" }

  // La RPC a tranché (statut + approbation immuable + commentaire éventuel) ;
  // la décision est acquise. La notification vient APRÈS et n'est jamais
  // bloquante — le contenu ne doit pas rester en attente si Brevo tousse.
  const approved = decision === "approved"
  await notifyOrgMembers({
    orgId: ctx.orgId,
    clientId: ctx.clientId,
    type: approved ? "content_approved" : "changes_requested",
    title: approved ? `« ${ctx.title} » approuvé` : `Modifications demandées sur « ${ctx.title} »`,
    body: message ? excerpt(message) : `Décision de ${ctx.name ?? "votre client"}.`,
    href: routes.content(ctx.clientId, contentItemId),
    template: approved ? "content-approved" : "changes-requested",
    params: {
      author_name: ctx.name ?? "Votre client",
      content_title: ctx.title,
      comment: message ? excerpt(message, 400) : "",
    },
    tags: [approved ? "content-approved" : "changes-requested"],
  })

  revalidatePath(`/clients/${ctx.clientId}/content/${contentItemId}`)
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

  // Défense en profondeur : l'ancre doit appartenir AU contenu commenté. La FK
  // composite (annotation_content_media_id, client_id) ne garantit que le même
  // CLIENT — sans ce contrôle, un reviewer pourrait épingler sa remarque sur le
  // média d'un autre contenu du même client (pas une fuite inter-tenant, mais
  // un repère qui apparaît sur le mauvais post). La lecture passe par la RLS.
  if (annotation) {
    const { data: anchor } = await ctx.supabase
      .from("content_media")
      .select("id")
      .eq("id", annotation.contentMediaId)
      .eq("content_item_id", contentItemId)
      .maybeSingle()
    if (!anchor) return { ok: false, error: "invalid_anchor" }
  }

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

  // Notifier l'agence — UNIQUEMENT sur un retour client. Une réponse de
  // l'agence (ou une note interne) n'a personne à prévenir de ce côté.
  if (authorRole === "reviewer" && visibility === "client") {
    await notifyOrgMembers({
      orgId: ctx.orgId,
      clientId: ctx.clientId,
      type: "review_comment",
      title: `Nouveau retour sur « ${ctx.title} »`,
      body: excerpt(body),
      href: routes.content(ctx.clientId, contentItemId),
      template: "review-comment",
      params: {
        author_name: ctx.name ?? "Votre client",
        content_title: ctx.title,
        comment: excerpt(body, 400),
        pinned: Boolean(annotation),
      },
      tags: ["review-comment"],
    })
  }

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
    const { supabase } = await requireClientInOrg(clientId)
    // P7-7 : passage par la RPC 032. L'INSERT nu échouait en 23505 dès qu'une
    // invitation PÉRIMÉE traînait pour la même adresse — l'index unique partiel
    // ignore `expires_at`, et `revoked_at` n'était écrit nulle part. Résultat :
    // une adresse mal saisie était bannie à vie de ce client. La RPC retire
    // l'ancienne ligne puis insère, dans la même transaction.
    const { error } = await supabase.rpc("invite_client_reviewer", {
      _client: clientId,
      _email: normalizedEmail,
      _token_hash: tokenHash,
      _expires_at: expiresAt,
    })
    // Les codes que la RPC lève réellement (032) sont traduits ici. Sans ce
    // mapping, ils retombaient tous sur `db_error`, donc sur un message
    // générique : l'utilisateur voyait « l'invitation n'a pas pu être créée »
    // pour une adresse mal tapée comme pour une panne, et croyait à un bug
    // transitoire dans les deux cas.
    //   23505 ne signifie plus « déjà invité » mais « déjà MEMBRE » : la RPC
    //         supersède les invitations vivantes et ne lève que dans ce cas.
    //   22023 = adresse rejetée par la RPC (vide, ou sans « @ »).
    if (error) {
      if (error.code === "23505") return { ok: false, error: "already_member" }
      if (error.code === "22023") return { ok: false, error: "invalid_email" }
      return { ok: false, error: "db_error" }
    }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  // Email d'invitation — BEST-EFFORT (Tier D). Sans Brevo configuré,
  // sendTransactional lève et on ignore : l'invitation reste valide et le lien
  // d'acceptation est affiché dans l'UI. Auto-actif dès que Brevo est câblé.
  try {
    const origin = await siteOrigin()
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

const revokeSchema = z.object({
  clientId: z.string().uuid(),
  invitationId: z.string().uuid(),
})

/**
 * Révoque une invitation non acceptée (P7-7).
 *
 * Sans elle, `revoked_at` n'était écrit nulle part dans le dépôt : la seule
 * sortie de l'index unique partiel était l'acceptation, c'est-à-dire le cas où
 * tout se passe bien. Une adresse mal saisie restait bloquée à vie.
 */
export async function revokeInvitation(input: unknown): Promise<ActionResult> {
  const parsed = revokeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, invitationId } = parsed.data

  try {
    const { supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.rpc("revoke_client_invitation", {
      _invitation: invitationId,
    })
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}

const removeMemberSchema = z.object({
  clientId: z.string().uuid(),
  userId: z.string().uuid(),
})

/**
 * Retire un reviewer d'un client (P7-7).
 *
 * C'est la révocation de la **règle 4** : elle doit être effective
 * immédiatement, ce qui est précisément la raison pour laquelle ce projet
 * refuse les claims JWT d'autorisation et lit deux tables d'appartenance à
 * chaque requête. Cette promesse tenait sans qu'aucun bouton ne permette de la
 * prononcer. La RPC révoque au passage toute invitation encore vivante pour la
 * même adresse — sinon on retire d'un côté ce qu'un jeton non consommé permet
 * de reprendre de l'autre.
 */
export async function removeClientMember(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, userId } = parsed.data

  try {
    const { supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.rpc("remove_client_member", {
      _client: clientId,
      _user: userId,
    })
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  revalidatePath("/portal")
  return { ok: true }
}

const leaveSchema = z.object({ clientId: z.string().uuid() })

/**
 * Retire l'appelant LUI-MÊME d'un client (V-3, migration 034).
 *
 * Il n'existait aucune sortie : `client_members_delete` (004:101-103) exige
 * `is_org_member(org_id)`, or un Reviewer n'appartient par construction à
 * aucune organisation (règle 6). Seule l'agence pouvait le retirer.
 *
 * C'était l'aggravant de la CSRF : une adhésion créée à l'insu de la victime
 * dans le client d'un ATTAQUANT n'était révocable que par l'attaquant. La CSRF
 * est fermée en amont ; ceci est le filet qui rend l'état réparable par la
 * personne concernée.
 *
 * ⚠️ Volontairement PAS de `requireClientInOrg` ici : cette action sert
 * précisément à quelqu'un qui n'est membre d'AUCUNE org. L'autorisation est
 * portée par la RPC, dont le périmètre est borné par `user_id = auth.uid()` —
 * lu dans le JWT, jamais dans un paramètre. `clientId` ne choisit donc que le
 * client à quitter, jamais la personne à retirer.
 */
export async function leaveClient(input: unknown): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("leave_client", { _client: parsed.data.clientId })
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/portal")
  revalidatePath("/", "layout")
  return { ok: true }
}
