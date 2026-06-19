import { CLIENTS } from "./clients"
import { IMAGES } from "./images"
import { dayAt } from "./time"
import type { Client, EngagementStats, ImportedPost } from "./types"

// Feed Instagram « réel » importé à la connexion du compte (PRD §5.C).
// On prend la fin du pool d'images pour ne pas dupliquer les posts app.

// Métriques de base cyclées (petit commerce : reach modeste, ER correct).
const BASE_METRICS: EngagementStats[] = [
  { likes: 184, comments: 12, reach: 2350, saves: 31 },
  { likes: 96, comments: 5, reach: 1410, saves: 14 },
  { likes: 233, comments: 19, reach: 3120, saves: 58 },
  { likes: 61, comments: 3, reach: 870, saves: 6 },
  { likes: 142, comments: 9, reach: 1980, saves: 22 },
  { likes: 118, comments: 7, reach: 1640, saves: 18 },
]

// Top post évident par client (candidat « recycler ») : index du post importé.
const TOP_METRICS: Record<string, { index: number; metrics: EngagementStats }> = {
  cl_brulerie: { index: 1, metrics: { likes: 1840, comments: 96, reach: 24300, saves: 412 } },
  cl_verde: { index: 2, metrics: { likes: 1210, comments: 64, reach: 16800, saves: 287 } },
  cl_nove: { index: 1, metrics: { likes: 935, comments: 41, reach: 12400, saves: 198 } },
  cl_rise: { index: 2, metrics: { likes: 644, comments: 38, reach: 8900, saves: 153 } },
}

function buildImported(client: Client): ImportedPost[] {
  const pool = IMAGES[client.theme]
  const top = TOP_METRICS[client.id]
  const out: ImportedPost[] = []
  for (let j = 0; j < 6; j++) {
    const url = pool[pool.length - 1 - j]
    out.push({
      id: `imp_${client.id}_${j}`,
      clientId: client.id,
      thumbUrl: url,
      permalink: `https://instagram.com/p/imp_${client.id}_${j}`,
      publishedAt: dayAt(-16 - j * 4, 12),
      mediaType: j === 1 ? "video" : "image",
      metrics: top?.index === j ? top.metrics : BASE_METRICS[j % BASE_METRICS.length],
      pinned: j === 0 ? true : undefined,
    })
  }
  return out
}

export const IMPORTED_POSTS: ImportedPost[] = CLIENTS.filter((c) => !c.archivedAt).flatMap(
  buildImported
)
