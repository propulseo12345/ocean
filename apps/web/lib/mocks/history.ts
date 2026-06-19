import { dayAt } from "./time"
import type { ActivityEntry, ContentVersion } from "./types"

// Versions envoyées en validation (diff de légende, badge « approbation
// périmée » actionnable) — sur les contenus en changes_requested.
export const CONTENT_VERSIONS: ContentVersion[] = [
  {
    id: "cv_bru13_1",
    contentId: "ct_cl_brulerie_13",
    label: "v1",
    caption: "Le geste, la mousse, le détail. Un moment de calme avant le rush du weekend.",
    note: "Première version envoyée en validation.",
    createdAt: dayAt(-4, 18),
  },
  {
    id: "cv_bru13_2",
    contentId: "ct_cl_brulerie_13",
    label: "v2",
    caption: "Le geste, la mousse, le détail. Petit moment de calme avant le rush du week-end.",
    note: "Photo éclaircie et « weekend » corrigé en « week-end », suite au retour de Camille.",
    createdAt: dayAt(-2, 9),
  },
  {
    id: "cv_bru13_3",
    contentId: "ct_cl_brulerie_13",
    label: "v3",
    caption: "Le geste, la mousse, le détail. Petit moment de calme avant le rush du matin.",
    note: "Chute reformulée — en attente du retour de Camille.",
    createdAt: dayAt(-1, 18),
  },
  {
    id: "cv_nov13_1",
    contentId: "ct_cl_nove_13",
    label: "v1",
    caption: "Maille côtelée : 3 façons de la porter en mi-saison.",
    note: "Première version envoyée en validation.",
    createdAt: dayAt(-3, 10),
  },
  {
    id: "cv_nov13_2",
    contentId: "ct_cl_nove_13",
    label: "v2",
    caption: "Comment porter la maille côtelée en mi-saison : 3 pièces, 1 silhouette.",
    note: "Accroche réécrite suite au retour de Léa.",
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
    detail: "Contenu créé dans le studio.",
  },
  {
    id: "act_bru0_2",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-15, 10),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: "Légende et hashtags retravaillés.",
  },
  {
    id: "act_bru0_3",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-15, 11),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: "Envoyé en validation à Camille Lacaze.",
  },
  {
    id: "act_bru0_4",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 9),
    actorName: "Camille Lacaze",
    kind: "commented",
    detail: "« Parfait pour le lancement de samedi ! »",
  },
  {
    id: "act_bru0_5",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 9, 30),
    actorName: "Camille Lacaze",
    kind: "approved",
    detail: "Approuvé (v1).",
  },
  {
    id: "act_bru0_6",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-14, 10),
    actorName: "Étienne Mercier",
    kind: "scheduled",
    detail: "Programmé pour le 30 mai à 10 h 00 (heure de Paris).",
  },
  {
    id: "act_bru0_7",
    contentId: "ct_cl_brulerie_0",
    at: dayAt(-12, 8),
    actorName: "Ocean",
    kind: "published",
    detail: "Publié sur Instagram et Facebook.",
  },
  // ct_cl_verde_4 — partiellement publié
  {
    id: "act_ver4_1",
    contentId: "ct_cl_verde_4",
    at: dayAt(-5, 9),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: "Contenu créé dans le studio.",
  },
  {
    id: "act_ver4_2",
    contentId: "ct_cl_verde_4",
    at: dayAt(-4, 16),
    actorName: "Étienne Mercier",
    kind: "scheduled",
    detail: "Programmé pour le 9 juin à 11 h 00 (heure de Paris).",
  },
  {
    id: "act_ver4_3",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9),
    actorName: "Ocean",
    kind: "published",
    detail: "Publié sur Instagram.",
  },
  {
    id: "act_ver4_4",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9, 1),
    actorName: "Ocean",
    kind: "failed",
    detail: "Échec Facebook : média refusé (ratio non conforme).",
  },
  {
    id: "act_ver4_5",
    contentId: "ct_cl_verde_4",
    at: dayAt(-2, 9, 30),
    actorName: "Ocean",
    kind: "retried",
    detail: "Nouvelle tentative Facebook — erreur permanente, pas de relance automatique.",
  },
  // ct_cl_brulerie_13 — corrections en cours
  {
    id: "act_bru13_1",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-5, 15),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: "Contenu créé dans le studio.",
  },
  {
    id: "act_bru13_2",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-4, 18),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: "v1 envoyée à Camille Lacaze.",
  },
  {
    id: "act_bru13_3",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-1, 14),
    actorName: "Camille Lacaze",
    kind: "changes_requested",
    detail: "Modifications demandées : éclaircir la photo, corriger « week-end ».",
  },
  {
    id: "act_bru13_4",
    contentId: "ct_cl_brulerie_13",
    at: dayAt(-1, 18),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: "v3 préparée — chute reformulée.",
  },
  // ct_cl_nove_13 — corrections en cours
  {
    id: "act_nov13_1",
    contentId: "ct_cl_nove_13",
    at: dayAt(-4, 11),
    actorName: "Étienne Mercier",
    kind: "created",
    detail: "Contenu créé dans le studio.",
  },
  {
    id: "act_nov13_2",
    contentId: "ct_cl_nove_13",
    at: dayAt(-3, 10),
    actorName: "Étienne Mercier",
    kind: "sent_for_review",
    detail: "v1 envoyée à Léa Nove.",
  },
  {
    id: "act_nov13_3",
    contentId: "ct_cl_nove_13",
    at: dayAt(-1, 15),
    actorName: "Léa Nove",
    kind: "changes_requested",
    detail: "Accroche jugée trop plate — à réécrire.",
  },
  {
    id: "act_nov13_4",
    contentId: "ct_cl_nove_13",
    at: dayAt(-1, 16),
    actorName: "Étienne Mercier",
    kind: "updated",
    detail: "v2 prête à renvoyer en validation.",
  },
]

/** Journal d'un contenu, trié du plus ancien au plus récent (timeline). */
export function getActivityEntries(contentId: string): ActivityEntry[] {
  return ACTIVITY_ENTRIES.filter((e) => e.contentId === contentId).sort((a, b) =>
    a.at.localeCompare(b.at)
  )
}
