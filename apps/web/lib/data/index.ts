import "server-only"

// Façade de données. Les lectures encore mockées viennent de `./mock` ; celles
// déjà câblées sur Supabase sont ré-exportées depuis `./pro` APRÈS le `export *`
// — un export nommé explicite prime sur l'export étoilé du même nom (règle ES).
// On bascule domaine par domaine ; le contrat (async + cache() + orgId) est
// identique, aucune page consommatrice n'a à changer.

export * from "./mock"
export type { ClientSettings } from "./pro"
// Phase 1 — configuration éditoriale câblée sur Supabase (migration 011).
// Phase 2 — médiathèque (getLibraryAssets, migration 012).
// Phase 3 — collaboration (migration 013).
// Phase 4 — feed importé & performance (migration 014).
// Phase 5 — agenda (calendar_accounts / calendar_events, migration 015).
// NB : getUnifiedAgenda reste mocké — sa branche « publication » exige le
// ContentItem + Client complets, donc le câblage des lectures de contenu.
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
  getQuotaUsage,
  getRecurringSlots,
  getReviewer,
  getReviewRequest,
  getSavedViews,
  getTopPosts,
} from "./pro"
