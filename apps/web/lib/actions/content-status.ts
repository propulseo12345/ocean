"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { pathFor, type StatusIntent } from "@/lib/domain/content-status"
import { routes } from "@/lib/routes"
import type { ActionResult } from "./_helpers"
import { requireClientInOrg } from "./_helpers"

// Transitions de statut (Phase 6). Chaque action traduit une INTENTION d'UI en
// une suite d'updates légaux au regard de la garde 008/016, appliqués un par un.
//
// Pourquoi pas un seul update : `changes_requested -> in_review` (conflit C1)
// n'existe pas dans la matrice — il faut repasser par `draft`. L'UI exprime
// « renvoyer en revue », l'action connaît le chemin. C'est la seule façon de
// tenir la promesse « aucun 42501 surprise » sans affaiblir la garde.

const intentSchema = z.enum([
  "send_to_review",
  "back_to_draft",
  "back_to_idea",
  "schedule",
  "approve",
  "cancel",
]) satisfies z.ZodType<StatusIntent>

const applySchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid(),
  intent: intentSchema,
})

/**
 * Applique une intention de changement de statut.
 *
 * Le statut de DÉPART est relu en base, jamais reçu du client : sinon un
 * appelant pourrait annoncer `from: 'draft'` sur un contenu approuvé et se voir
 * proposer un chemin qui ne lui est pas dû.
 */
export async function applyStatusIntent(
  input: z.infer<typeof applySchema>
): Promise<ActionResult<{ status: string }>> {
  const parsed = applySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId, intent } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)

  const { data: item } = await supabase
    .from("content_items")
    .select("id, status, client_id")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("id", contentId)
    .maybeSingle()
  if (!item) return { ok: false, error: "NOT_FOUND" }

  // Garde-fou métier : l'approbation directe n'existe que pour les clients en
  // publication directe. Le kanban le vérifie déjà, mais une Server Action est
  // une frontière publique — la vérification côté UI ne compte pas.
  if (intent === "approve") {
    const { data: client } = await supabase
      .from("clients")
      .select("approval_mode")
      .eq("org_id", orgId)
      .eq("id", clientId)
      .maybeSingle()
    if (client?.approval_mode !== "auto") return { ok: false, error: "APPROVAL_REQUIRED" }
  }

  const path = pathFor(intent, item.status as never)
  if (path === null) return { ok: false, error: "TRANSITION_NOT_ALLOWED" }
  if (path.length === 0) return { ok: true, data: { status: item.status } }

  // Les étapes sont appliquées SÉQUENTIELLEMENT : chacune doit passer la garde,
  // et la garde compare old.status à new.status. Un update groupé sauterait
  // l'état intermédiaire et se ferait refuser.
  for (const step of path) {
    const { error } = await supabase
      .from("content_items")
      .update({ status: step })
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("id", contentId)
    if (error) return { ok: false, error: error.message }
  }

  const finalStatus = path[path.length - 1]
  // File de publication (règle 15/16) : un contenu qui ATTEINT « scheduled » enfile
  // un job par cible API ; toute sortie de « scheduled » annule les jobs non
  // démarrés. Les RPC sont idempotentes et no-op hors de ces cas — sûr à appeler
  // sur toute transition. Un échec d'enfilement ne doit pas casser la transition
  // (déjà persistée) : on ignore l'erreur RPC (le watchdog worker rattrapera).
  if (finalStatus === "scheduled") {
    await supabase.rpc("enqueue_publish_jobs", { _content_item: contentId })
  } else {
    await supabase.rpc("cancel_publish_jobs", { _content_item: contentId })
  }

  revalidatePath(routes.content(clientId, contentId))
  revalidatePath(routes.clientContent(clientId))
  return { ok: true, data: { status: finalStatus } }
}

const targetSchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid(),
  targetId: z.string().uuid(),
})

const manualPublishSchema = targetSchema.extend({
  externalPostId: z.string().trim().min(1).max(255).optional(),
  permalink: z.string().trim().url().max(2000).optional(),
})

/**
 * Déclare qu'une cible a été publiée À LA MAIN (brouillon TikTok finalisé dans
 * l'app, newsletter envoyée). Passe par la RPC : `status='published'` est
 * interdit à `authenticated` par la garde de 013, et doit le rester — c'est ce
 * qui empêche de fabriquer une publication fantôme par un PATCH direct.
 */
export async function markTargetPublishedManually(
  input: z.infer<typeof manualPublishSchema>
): Promise<ActionResult<{ status: string }>> {
  const parsed = manualPublishSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId, targetId, externalPostId, permalink } = parsed.data

  const { supabase } = await requireClientInOrg(clientId)

  const { data, error } = await supabase.rpc("mark_target_published_manually", {
    _target: targetId,
    _external_post_id: externalPostId ?? null,
    _permalink: permalink ?? null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.content(clientId, contentId))
  return { ok: true, data: { status: data as string } }
}

/**
 * Demande une nouvelle tentative sur une cible en échec.
 *
 * RÈGLE 15 : on pose une INTENTION (`retry_requested_at`), on ne remet pas la
 * cible en file. C'est le worker qui reprend, et lui seul interroge le
 * container quand `publish_started_at` est non nul. Une UI qui remettrait le
 * statut à 'queued' court-circuiterait ce contrôle : double publication chez
 * un client.
 */
export async function requestTargetRetry(
  input: z.infer<typeof targetSchema>
): Promise<ActionResult<{ requestedAt: string }>> {
  const parsed = targetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId, targetId } = parsed.data

  const { supabase } = await requireClientInOrg(clientId)

  const { data, error } = await supabase.rpc("request_target_retry", { _target: targetId })
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.content(clientId, contentId))
  return { ok: true, data: { requestedAt: data as string } }
}
