import type { SavedView } from "./types"

// Vues filtrées enregistrées du studio — réutilisables par tous les clients.
export const SAVED_VIEWS: SavedView[] = [
  {
    id: "sv_bru_atraiter",
    clientId: "cl_brulerie",
    name: "À traiter",
    filters: { statuses: ["changes_requested", "failed", "draft"] },
  },
  {
    id: "sv_bru_attente",
    clientId: "cl_brulerie",
    name: "En attente client",
    filters: { statuses: ["in_review"] },
  },
  {
    id: "sv_ver_atraiter",
    clientId: "cl_verde",
    name: "À traiter",
    filters: { statuses: ["changes_requested", "failed", "draft"] },
  },
  {
    id: "sv_ver_reels",
    clientId: "cl_verde",
    name: "Reels uniquement",
    filters: { formats: ["reel"] },
  },
  {
    id: "sv_nov_drops",
    clientId: "cl_nove",
    name: "Drops & promos",
    filters: { labels: ["Lancement", "Promo"] },
  },
  {
    id: "sv_nov_attente",
    clientId: "cl_nove",
    name: "En attente client",
    filters: { statuses: ["in_review"] },
  },
  {
    id: "sv_ris_idees",
    clientId: "cl_rise",
    name: "Banque d'idées",
    filters: { statuses: ["idea"] },
  },
]

export function getSavedViews(clientId: string): SavedView[] {
  return SAVED_VIEWS.filter((v) => v.clientId === clientId)
}
