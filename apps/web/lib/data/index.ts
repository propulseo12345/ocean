import "server-only"

// Façade de données : le point d'entrée UNIQUE des lectures serveur.
//
// Toutes les lectures sont désormais câblées sur Supabase — `./mock` a été
// supprimé. Chaque nom est exporté EXPLICITEMENT depuis son module, jamais par
// `export *` : tant que les deux existaient, `getPortalContent` mocké et réel
// avaient la même signature, et c'étaient les règles de shadowing ES qui
// départageaient — un ordre d'export malencontreux aurait servi des données
// mockées sans que le typecheck bronche. Un export explicite rend la chose
// impossible.
//
// Contrat commun : `async` + `cache()` + `org_id` en premier argument (sauf le
// portail, scopé par `client_ids` — un Reviewer n'a pas d'org active).
export {
  getClient,
  getClients,
  getCurrentUser,
  getSocialAccounts,
} from "./clients"
export {
  getContentItem,
  getContentItems,
  getPortalContent,
  getPortalContentItem,
  getTrashedContent,
} from "./content"
export { getDashboardTasks, getShellSnapshot, getUnifiedAgenda } from "./dashboard"
export { getNotifications, getUnreadCount } from "./notifications"
export type { ClientSettings } from "./pro"
export {
  getActivityEntries,
  getApprovals,
  getBrandKit,
  getCalendarAccounts,
  getCalendarEvents,
  getClientEvents,
  getClientSettings,
  getComments,
  getContentVersions,
  getHashtagGroups,
  getImportedPosts,
  getLibraryAssets,
  getPillars,
  getPostMetrics,
  getPostMetricsBatch,
  getQuotaUsage,
  getRecurringSlots,
  getReviewer,
  getReviewRequest,
  getSavedViews,
  getTopPosts,
} from "./pro"
