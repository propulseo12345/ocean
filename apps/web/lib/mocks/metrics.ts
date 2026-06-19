import { CONTENT_ITEMS } from "./content"
import { IMPORTED_POSTS } from "./imported"
import type { ContentStatus, EngagementStats, PostMetrics } from "./types"

// Métriques de performance par post (page Performance, « recycler un top
// post »). Posts app publiés + posts importés (métriques inline reprises).

const MEASURED: ContentStatus[] = ["published", "partially_published"]

// Bases cyclées pour les posts publiés via l'app (variées, réalistes).
const APP_BASES: EngagementStats[] = [
  { likes: 128, comments: 8, reach: 1720, saves: 19 },
  { likes: 287, comments: 21, reach: 3640, saves: 74 },
  { likes: 74, comments: 4, reach: 980, saves: 9 },
  { likes: 196, comments: 13, reach: 2510, saves: 41 },
  { likes: 52, comments: 2, reach: 640, saves: 5 },
]

// Réglages ciblés : un top app évident (Verde) et un flop net (Rise).
const APP_OVERRIDES: Record<string, EngagementStats> = {
  ct_cl_verde_1: { likes: 1430, comments: 87, reach: 18700, saves: 388 },
  ct_cl_rise_3: { likes: 12, comments: 0, reach: 410, saves: 1 },
}

function appMetrics(): PostMetrics[] {
  return CONTENT_ITEMS.filter((c) => MEASURED.includes(c.status) && !c.deletedAt).map((c, i) => ({
    refId: c.id,
    ...(APP_OVERRIDES[c.id] ?? APP_BASES[i % APP_BASES.length]),
  }))
}

function importedMetrics(): PostMetrics[] {
  return IMPORTED_POSTS.flatMap((p) => (p.metrics ? [{ refId: p.id, ...p.metrics }] : []))
}

export const POST_METRICS: PostMetrics[] = [...appMetrics(), ...importedMetrics()]

/** Métriques d'un post (ContentItem.id ou ImportedPost.id). */
export function getPostMetrics(refId: string): PostMetrics | undefined {
  return POST_METRICS.find((m) => m.refId === refId)
}

/** Tops posts d'un client (app + importés), triés par reach décroissant. */
export function getTopPosts(clientId: string, limit = 3): PostMetrics[] {
  const ids = new Set([
    ...CONTENT_ITEMS.filter((c) => c.clientId === clientId).map((c) => c.id),
    ...IMPORTED_POSTS.filter((p) => p.clientId === clientId).map((p) => p.id),
  ])
  return POST_METRICS.filter((m) => ids.has(m.refId))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, limit)
}
