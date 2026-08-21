import "server-only"

import type { requireClientInOrg } from "./_helpers"

// Réconciliation des tables filles d'un contenu : cibles, médias, étiquettes.
//
// DEUX DÉFAUTS CORRIGÉS ICI (ticket P5-3)
// ---------------------------------------
// 1. AUCUNE des 8 écritures ne lisait son `error`, et `saveContentItem` renvoyait
//    `ok: true` quoi qu'il arrive. Le scénario : le DELETE passe (transaction 1
//    committée), l'INSERT échoue (contrainte, coupure, RLS). Le toast dit
//    « enregistré » et le contenu se retrouve SANS AUCUNE CIBLE — il apparaît
//    normalement au calendrier et ne partira jamais.
//
// 2. Le motif était delete-all + insert-all. Non transactionnel (chaque appel
//    PostgREST est sa propre transaction) et destructeur bien au-delà de son
//    objet :
//      * les cibles perdaient `status`, `external_post_id`, `permalink` et
//        l'ancre de la règle 15 à chaque enregistrement ;
//      * les liaisons médias étaient recréées avec de NOUVEAUX id, or
//        `content_comments.annotation_content_media_id` cascade dessus (013:138)
//        — les commentaires ANNOTÉS du client étaient donc supprimés, la ligne
//        entière, pas seulement l'ancre.
//
// D'où la réconciliation par DIFF : on ne touche qu'à ce qui change réellement.
// Ce qui ne bouge pas garde son id, donc son historique et ses annotations.
//
// Ce que ce module ne fait toujours PAS : de l'atomicité. Trois tables, plusieurs
// requêtes, pas de transaction — la vraie réponse reste une RPC
// `save_content_item(payload jsonb)`. Ce qui change, c'est qu'un échec est
// désormais REMONTÉ au lieu d'être annoncé comme un succès.

type Db = Awaited<ReturnType<typeof requireClientInOrg>>["supabase"]

/** `null` = tout s'est bien passé. Sinon, le premier échec rencontré. */
export type ReconcileError = string | null

/**
 * Cibles : comptes sociaux + plateformes manuelles.
 *
 * Clé d'identité : le compte social pour une cible API, la plateforme pour une
 * cible manuelle (`social_account_id` y est null, et les NULL ne se heurtent pas
 * dans `content_targets_item_account_idx`).
 *
 * Les cibles conservées ne sont pas réécrites — c'est le point : leur statut,
 * leur `external_post_id`, leur permalien et leur ancre d'idempotence survivent
 * à un simple enregistrement de légende.
 */
export async function reconcileTargets(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  accountIds: string[],
  manualPlatforms: readonly string[]
): Promise<ReconcileError> {
  // Défense : le compte social doit appartenir au client.
  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id, platform")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
  if (accountsError) return accountsError.message

  const platformById = new Map((accounts ?? []).map((a) => [a.id, a.platform]))
  const wantedAccounts = accountIds.filter((id) => platformById.has(id))
  const wantedManual = [...new Set(manualPlatforms)]

  const { data: existing, error: readError } = await supabase
    .from("content_targets")
    .select("id, social_account_id, platform")
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)
  if (readError) return readError.message

  const keep = new Set<string>()
  const obsolete: string[] = []
  for (const target of existing ?? []) {
    const wanted = target.social_account_id
      ? wantedAccounts.includes(target.social_account_id)
      : wantedManual.includes(target.platform)
    if (wanted) keep.add(target.social_account_id ?? `manual:${target.platform}`)
    else obsolete.push(target.id)
  }

  if (obsolete.length) {
    // Un refus 42501 ici est ATTENDU et signifiant : la cible porte l'ancre de
    // la règle 15 (garde 023/026). Le remonter vaut mieux que l'avaler — le
    // contenu a peut-être déjà été publié sur cette plateforme.
    const { error } = await supabase.from("content_targets").delete().in("id", obsolete)
    if (error) return error.message
  }

  const rows = [
    ...wantedAccounts
      .filter((id) => !keep.has(id))
      .map((id) => ({
        org_id: orgId,
        client_id: clientId,
        content_item_id: contentId,
        social_account_id: id,
        platform: platformById.get(id) as string,
      })),
    ...wantedManual
      .filter((platform) => !keep.has(`manual:${platform}`))
      .map((platform) => ({
        org_id: orgId,
        client_id: clientId,
        content_item_id: contentId,
        social_account_id: null,
        platform,
      })),
  ]
  if (rows.length) {
    const { error } = await supabase.from("content_targets").insert(rows)
    if (error) return error.message
  }
  return null
}

/** Étiquettes : upsert par nom, puis diff des liaisons. */
export async function reconcileLabels(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string,
  labels: string[]
): Promise<ReconcileError> {
  const wanted = [...new Set(labels)]

  const { data: existingLinks, error: linksError } = await supabase
    .from("content_item_labels")
    .select("content_label_id")
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)
  if (linksError) return linksError.message
  const linked = new Set((existingLinks ?? []).map((l) => l.content_label_id))

  if (!wanted.length) {
    if (!linked.size) return null
    const { error } = await supabase
      .from("content_item_labels")
      .delete()
      .eq("org_id", orgId)
      .eq("content_item_id", contentId)
    return error ? error.message : null
  }

  const { data: known, error: knownError } = await supabase
    .from("content_labels")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("name", wanted)
  if (knownError) return knownError.message
  const idByName = new Map((known ?? []).map((l) => [l.name, l.id]))

  const toCreate = wanted.filter((name) => !idByName.has(name))
  if (toCreate.length) {
    const { data: created, error } = await supabase
      .from("content_labels")
      .insert(toCreate.map((name) => ({ org_id: orgId, client_id: clientId, name })))
      .select("id, name")
    if (error) return error.message
    for (const l of created ?? []) idByName.set(l.name, l.id)
  }

  const wantedIds = new Set(
    wanted.map((name) => idByName.get(name)).filter((id): id is string => id !== undefined)
  )

  const obsolete = [...linked].filter((id) => !wantedIds.has(id))
  if (obsolete.length) {
    const { error } = await supabase
      .from("content_item_labels")
      .delete()
      .eq("org_id", orgId)
      .eq("content_item_id", contentId)
      .in("content_label_id", obsolete)
    if (error) return error.message
  }

  const missing = [...wantedIds].filter((id) => !linked.has(id))
  if (missing.length) {
    const { error } = await supabase.from("content_item_labels").insert(
      missing.map((content_label_id) => ({
        org_id: orgId,
        client_id: clientId,
        content_item_id: contentId,
        content_label_id,
      }))
    )
    if (error) return error.message
  }
  return null
}
