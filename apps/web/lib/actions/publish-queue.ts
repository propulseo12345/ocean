import "server-only"

import { log } from "@/lib/log"
import type { requireClientInOrg } from "./_helpers"

// LE point unique de synchronisation entre ce que l'app affiche et ce que le
// worker exécutera.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Avant lui, le lien tenait à DEUX appels manuels — `applyStatusIntent` et
// `scheduleContentItem` — et toute autre écriture désynchronisait en silence :
//
//   * `trashContent` posait `deleted_at` sans rien désenfiler : le contenu
//     supprimé partait quand même à l'heure prévue, sur le vrai compte du client ;
//   * `saveContentItem` réécrivait `scheduled_at` sans réaligner `run_at` : le
//     calendrier affichait 17 h, le worker publiait à 9 h ;
//   * retirer la date (`scheduledAt: null` depuis le composer) laissait le job
//     vivant.
//
// Le problème de fond n'était pas les trois oublis, c'était la forme : chaque
// appelant devait CHOISIR entre enfiler et annuler, donc chaque nouvelle surface
// d'édition rouvrait l'écart. Ici, personne ne choisit. On relit l'état réel du
// contenu en base et on en DÉDUIT ce que la file doit contenir.
//
// L'invariant, en une phrase : un contenu a des jobs vivants si et seulement si
// il est `scheduled`, daté, et non supprimé.

type Db = Awaited<ReturnType<typeof requireClientInOrg>>["supabase"]

export type SyncOutcome =
  /** Jobs alignés sur la date courante (`jobs` = cibles enfilées ou réalignées). */
  | { ok: true; action: "enqueued"; jobs: number }
  /** Jobs non démarrés annulés (`jobs` = jobs effectivement annulés). */
  | { ok: true; action: "canceled"; jobs: number }
  /**
   * Le contenu s'affiche « Programmé » et AUCUN job n'existera : il ne partira
   * jamais, sans le moindre signal. Cf. `SCHEDULED_WITHOUT_JOB` ci-dessous.
   */
  | { ok: false; error: "SCHEDULED_WITHOUT_JOB" }
  /** Le contenu n'existe plus (ou n'appartient pas à ce tenant). */
  | { ok: false; error: "NOT_FOUND" }
  /** La RPC a échoué : la file est peut-être désalignée. */
  | { ok: false; error: string }

/**
 * Aligne la file de publication sur l'état réel d'un contenu.
 *
 * À appeler après TOUTE écriture qui touche `status`, `scheduled_at` ou
 * `deleted_at`. Idempotente et sûre à appeler même quand rien n'a changé : les
 * deux RPC sont no-op hors de leur cas.
 *
 * Ne lève jamais — l'appelant décide quoi faire du résultat (cf. P4-4). Une
 * transition déjà persistée ne doit pas être annulée parce que l'enfilement a
 * hoqueté ; mais elle ne doit pas non plus être annoncée comme un succès complet.
 */
export async function syncPublishQueue(
  supabase: Db,
  orgId: string,
  clientId: string,
  contentId: string
): Promise<SyncOutcome> {
  const { data: item, error: readError } = await supabase
    .from("content_items")
    .select("status, scheduled_at, deleted_at")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("id", contentId)
    .maybeSingle()

  if (readError) return { ok: false, error: readError.message }
  if (!item) return { ok: false, error: "NOT_FOUND" }

  // La seule condition qui justifie des jobs vivants. Le `deleted_at` est le
  // point que le worker ne vérifie PAS de son côté : son claim ne joint jamais
  // content_items.
  const shouldBeQueued =
    item.deleted_at === null && item.status === "scheduled" && item.scheduled_at !== null

  const rpc = shouldBeQueued ? "enqueue_publish_jobs" : "cancel_publish_jobs"
  const { data, error } = await supabase.rpc(rpc, { _content_item: contentId })

  if (error) {
    // Journalisé ici parce que c'est le seul endroit qui connaît la nature de
    // l'écart. Le canal du §10 n'existe pas encore ; le log est le seul filet.
    log.error("syncPublishQueue: la file n'a PAS pu etre alignee", {
      contentId,
      clientId,
      orgId,
      intent: rpc,
      error: error.message,
    })
    return { ok: false, error: error.message }
  }

  const jobs = (data as number | null) ?? 0
  if (!shouldBeQueued) return { ok: true, action: "canceled", jobs }

  // P4-4 — Le résultat de l'enfilement était jeté, et le commentaire justifiait
  // l'omission par « le watchdog worker rattrapera » : il n'existe pas. Or la
  // RPC renvoie 0 EN SILENCE dans deux cas très ordinaires — aucune cible ne
  // porte de `social_account_id` (l'état exact de la phase solo avant OAuth),
  // ou toutes les cibles sont exclues du ré-enfilement (P3-4). Le contenu
  // s'affiche alors « Programmé » partout, zéro job en file, aucun signal.
  //
  // On ne peut pas déduire la panne du seul `jobs === 0` : un contenu 100 %
  // manuel (newsletter, sur mesure) n'a légitimement aucun job. La question
  // posée est donc la bonne : existe-t-il une cible qui AURAIT DÛ être enfilée ?
  if (jobs === 0) {
    const { count } = await supabase
      .from("content_targets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("content_item_id", contentId)
      .not("social_account_id", "is", null)
      .in("platform", ["instagram", "facebook", "tiktok"])

    if ((count ?? 0) > 0) {
      log.error("contenu programme SANS aucun job en file", {
        contentId,
        clientId,
        orgId,
        apiTargets: count,
      })
      return { ok: false, error: "SCHEDULED_WITHOUT_JOB" }
    }
  }

  return { ok: true, action: "enqueued", jobs }
}
