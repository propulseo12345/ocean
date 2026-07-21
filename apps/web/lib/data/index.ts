import "server-only"

// Façade de données. Les lectures encore mockées viennent de `./mock` ; celles
// déjà câblées sur Supabase sont ré-exportées depuis `./pro` APRÈS le `export *`
// — un export nommé explicite prime sur l'export étoilé du même nom (règle ES).
// On bascule domaine par domaine ; le contrat (async + cache() + orgId) est
// identique, aucune page consommatrice n'a à changer.

export * from "./mock"
export type { ClientSettings } from "./pro"
// Phase 1 — configuration éditoriale câblée sur Supabase (migration 011).
export {
  getBrandKit,
  getClientEvents,
  getClientSettings,
  getHashtagGroups,
  getPillars,
  getRecurringSlots,
  getSavedViews,
} from "./pro"
