import { loc } from "@/lib/i18n"
import { dayAt } from "./time"
import type { ActivityEntry, ContentVersion } from "./types"

// Versions envoyées en validation (diff de légende, badge « approbation
// périmée » actionnable) — sur les contenus en changes_requested.
export const CONTENT_VERSIONS: ContentVersion[] = [
  {
    id: "cv_bru13_1",
    contentId: "ct_cl_brulerie_13",
    label: "v1",
    caption: loc(
      "Le geste, la mousse, le détail. Un moment de calme avant le rush du weekend.",
      "The motion, the foam, the details. A quiet moment before the weekend rush."
    ),
    note: loc(
      "Première version envoyée en validation.",
      "First version sent for review."
    ),
    createdAt: dayAt(-4, 18),
  },
  {
    id: "cv_bru13_2",
    contentId: "ct_cl_brulerie_13",
    label: "v2",
    caption: loc(
      "Le geste, la mousse, le détail. Petit moment de calme avant le rush du week-end.",
      "The motion, the foam, the details. A little moment of calm before the weekend rush."
    ),
    note: loc(
      "Photo éclaircie et « weekend » corrigé en « week-end », suite au retour de Camille.",
      "Photo brightened and wording polished, following Camille's feedback."
    ),
    createdAt: dayAt(-2, 9),
  },
  {
    id: "cv_bru13_3",
    contentId: "ct_cl_brulerie_13",
    label: "v3",
    caption: loc(
      "Le geste, la mousse, le détail. Petit moment de calme avant le rush du matin.",
      "The motion, the foam, the details. A little moment of calm before the morning rush."
    ),
    note: loc(
      "Chute reformulée — en attente du retour de Camille.",
      "Closing line reworked — waiting on Camille's feedback."
    ),
    createdAt: dayAt(-1, 18),
  },
  {
    id: "cv_nov13_1",
    contentId: "ct_cl_nove_13",
    label: "v1",
    caption: loc(
      "Maille côtelée : 3 façons de la porter en mi-saison.",
      "Ribbed knit: 3 ways to style it for mid-season."
    ),
    note: loc(
      "Première version envoyée en validation.",
      "First version sent for review."
    ),
    createdAt: dayAt(-3, 10),
  },
  {
    id: "cv_nov13_2",
    contentId: "ct_cl_nove_13",
    label: "v2",
    caption: loc(
      "Comment porter la maille côtelée en mi-saison : 3 pièces, 1 silhouette.",
      "How to style a ribbed knit for mid-season: 3 pieces, 1 look."
    ),
    note: loc(
      "Accroche réécrite suite au retour de Léa.",
      "Hook rewritten following Léa's feedback."
    ),
    createdAt: dayAt(-1, 16),
  },
]

/** Versions d'un contenu, triées de la plus ancienne à la plus récente. */
export function getContentVersions(contentId: string): ContentVersion[] {
  return CONTENT_VERSIONS.filter((v) => v.contentId === contentId).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

// Journal d'activité (qui, quoi, quand) — riche sur un contenu publié,
// présent aussi sur un échec partiel et les deux contenus en correction.
export const ACTIVITY_ENTRIES: ActivityEntry[] = [
  // ct_cl_brulerie_0 — publié, cycle complet
  {
    id: "act_bru0_1",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-16, 14),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: loc("Contenu créé dans le studio.", "Content created in the studio."),
  },
  {
    id: "act_bru0_2",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-15, 10),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: loc("Légende et hashtags retravaillés.", "Caption and hashtags reworked."),
  },
  {
    id: "act_bru0_3",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-15, 11),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: loc("Envoyé en validation à Camille Lacaze.", "Sent to Camille Lacaze for review."),
  },
  {
    id: "act_bru0_4",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 9),
    actorName: "Camille Lacaze",
    kind: "commented",
    detail: loc("« Parfait pour le lancement de samedi ! »", "“Perfect for Saturday’s launch!”"),
  },
  {
    id: "act_bru0_5",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 9, 30),
    actorName: "Camille Lacaze",
    kind: "approved",
    detail: loc("Approuvé (v1).", "Approved (v1)."),
  },
  {
    id: "act_bru0_6",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 10),
    actorName: "Étienne Mercier",
    kind: "scheduled",
    detail: loc(
      "Programmé pour le 30 mai à 10 h 00 (heure de Paris).",
      "Scheduled for May 30 at 10:00 AM (Paris time)."
    ),
  },
  {
    id: "act_bru0_7",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-12, 8),
    actorName: "Ocean",
    kind: "published",
    detail: loc("Publié sur Instagram et Facebook.", "Published on Instagram and Facebook."),
  },
  // ct_cl_verde_4 — partiellement publié
  {
    id: "act_ver4_1",
    contentId: "ct_cl_verde_4",
    at: dayAt(-5, 9),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: loc("Contenu créé dans le studio.", "Content created in the studio."),
  },
  {
    id: "act_ver4_2",
    contentId: "ct_cl_verde_4",
    at: dayAt(-4, 16),
    actorName: "Étienne Mercier",
    kind: "scheduled",
    detail: loc(
      "Programmé pour le 9 juin à 11 h 00 (heure de Paris).",
      "Scheduled for June 9 at 11:00 AM (Paris time)."
    ),
  },
  {
    id: "act_ver4_3",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9),
    actorName: "Ocean",
    kind: "published",
    detail: loc("Publié sur Instagram.", "Published on Instagram."),
  },
  {
    id: "act_ver4_4",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9, 1),
    actorName: "Ocean",
    kind: "failed",
    detail: loc(
      "Échec Facebook : média refusé (ratio non conforme).",
      "Facebook failed: media rejected (non-compliant aspect ratio)."
    ),
  },
  {
    id: "act_ver4_5",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9, 30),
    actorName: "Ocean",
    kind: "retried",
    detail: loc(
      "Nouvelle tentative Facebook — erreur permanente, pas de relance automatique.",
      "Facebook retried — permanent error, no automatic retry."
    ),
  },
  // ct_cl_brulerie_13 — corrections en cours
  {
    id: "act_bru13_1",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-5, 15),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: loc("Contenu créé dans le studio.", "Content created in the studio."),
  },
  {
    id: "act_bru13_2",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-4, 18),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: loc("v1 envoyée à Camille Lacaze.", "v1 sent to Camille Lacaze."),
  },
  {
    id: "act_bru13_3",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-1, 14),
    actorName: "Camille Lacaze",
    kind: "changes_requested",
    detail: loc(
      "Modifications demandées : éclaircir la photo, corriger « week-end ».",
      "Changes requested: brighten the photo, fix the wording."
    ),
  },
  {
    id: "act_bru13_4",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-1, 18),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: loc("v3 préparée — chute reformulée.", "v3 prepared — closing line reworked."),
  },
  // ct_cl_nove_13 — corrections en cours
  {
    id: "act_nov13_1",
    contentId: "ct_cl_nove_13",
    at: dayAt(-4, 11),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: loc("Contenu créé dans le studio.", "Content created in the studio."),
  },
  {
    id: "act_nov13_2",
    contentId: "ct_cl_nove_13",
    at: dayAt(-3, 10),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: loc("v1 envoyée à Léa Nove.", "v1 sent to Léa Nove."),
  },
  {
    id: "act_nov13_3",
    contentId: "ct_cl_nove_13",
    at: dayAt(-1, 15),
    actorName: "Léa Nove",
    kind: "changes_requested",
    detail: loc("Accroche jugée trop plate — à réécrire.", "Hook felt too flat — needs a rewrite."),
  },
  {
    id: "act_nov13_4",
    contentId: "ct_cl_nove_13",
    at: dayAt(-1, 16),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: loc("v2 prête à renvoyer en validation.", "v2 ready to resubmit for review."),
  },
]

/** Journal d'un contenu, trié du plus ancien au plus récent (timeline). */
export function getActivityEntries(contentId: string): ActivityEntry[] {
  return ACTIVITY_ENTRIES.filter((e) => e.contentId === contentId).sort((a, b) =>
    a.at.localeCompare(b.at)
  )
}
