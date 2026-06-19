import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FeedGrid } from "@/components/app/grid/feed-grid"
import type { GridTileData, PillarOption } from "@/components/app/grid/grid-types"
import type { InstagramProfileData } from "@/components/app/grid/instagram-profile-header"
import { formatDayMonth } from "@/lib/format"
import {
  getBrandKit,
  getClient,
  getContentItems,
  getImportedPosts,
  getPillars,
  getPostMetrics,
  getQuotaUsage,
  getReviewer,
  getSocialAccounts,
  getTopPosts,
} from "@/lib/mocks"
import type { ContentItem, EngagementStats, ImportedPost, MediaAsset } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

const HIGHLIGHT_LABELS = ["Nouveautés", "Coulisses", "Avis", "Équipe"]

export const metadata: Metadata = { title: "Grille feed" }

// Les échecs, publications en cours et annulations restent VISIBLES dans la
// grille (audit §1, P0) — seuls les contenus du portail disparaissaient avant.
const PLANNED_STATUSES: ContentItem["status"][] = [
  "scheduled",
  "approved",
  "in_review",
  "changes_requested",
  "failed",
  "publishing",
  "canceled",
]
const PUBLISHED_STATUSES: ContentItem["status"][] = ["published", "partially_published"]
const SHELF_STATUSES: ContentItem["status"][] = ["idea", "draft"]

// Un contenu appartient au feed s'il vise Instagram et n'est pas une story.
// (Les idées sans média gardent leur place sur l'étagère — vignette de repli.)
function inFeed(c: ContentItem): boolean {
  if (c.format === "story") return false
  return c.targets.some((t) => t.platform === "instagram")
}

// Date affichée d'un publié = publication réelle de la cible IG, sinon scheduledAt.
function publishedDate(c: ContentItem): string | null {
  const ig = c.targets.find((t) => t.platform === "instagram")
  return ig?.publishedAt ?? c.scheduledAt
}

function placeholderMedia(post: ImportedPost): MediaAsset {
  return {
    id: post.id,
    type: post.mediaType,
    thumbUrl: post.thumbUrl,
    fullUrl: post.thumbUrl,
    width: 1080,
    height: 1080,
    position: 0,
  }
}

function metricsOf(refId: string): EngagementStats | undefined {
  const m = getPostMetrics(refId)
  return m ? { likes: m.likes, comments: m.comments, reach: m.reach, saves: m.saves } : undefined
}

function toContentTile(
  c: ContentItem,
  group: GridTileData["group"],
  dateIso: string | null,
  tz: string,
  topId: string | undefined
): GridTileData {
  const ig = c.targets.find((t) => t.platform === "instagram")
  return {
    id: c.id,
    group,
    media: c.media[0] ?? null,
    mediaCount: c.media.length,
    format: c.format,
    title: c.title,
    dateIso,
    tz,
    href: routes.content(c.clientId, c.id),
    permalink: ig?.permalink,
    status: c.status,
    platforms: c.targets.map((t) => ({ platform: t.platform, status: t.status })),
    pillarId: c.pillarId,
    pinned: c.pinned,
    excludedFromGrid: c.excludeFromGrid,
    coverUrl: c.coverUrl,
    caption: c.caption,
    commentsCount: c.commentsCount,
    approvalStale: c.approvalStale,
    lastError: c.lastError,
    metrics: metricsOf(c.id),
    isTopPost: topId === c.id,
  }
}

function toImportedTile(post: ImportedPost, tz: string, topId: string | undefined): GridTileData {
  return {
    id: post.id,
    group: "imported",
    media: placeholderMedia(post),
    mediaCount: 1,
    format: post.mediaType === "video" ? "reel" : "post",
    title: `Publication du ${formatDayMonth(post.publishedAt, tz)}`,
    dateIso: post.publishedAt,
    tz,
    permalink: post.permalink,
    status: "published",
    pinned: post.pinned,
    metrics: post.metrics,
    isTopPost: topId === post.id,
  }
}

function byDateDesc(a: GridTileData, b: GridTileData): number {
  return (b.dateIso ?? "").localeCompare(a.dateIso ?? "")
}

export default async function ClientGridPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client) notFound()
  const tz = client.timezone
  const topId = getTopPosts(clientId, 1)[0]?.refId

  const items = getContentItems(clientId).filter(inFeed)

  // Zone planifiée (datée) : déplaçables + échecs/en cours/annulés visibles.
  const scheduled = items
    .filter((c) => PLANNED_STATUSES.includes(c.status) && c.scheduledAt)
    .map((c) => toContentTile(c, "scheduled", c.scheduledAt, tz, topId))
    .sort(byDateDesc)

  // Publiés via l'app — verrouillés, après le séparateur « Aujourd'hui ».
  const publishedAll = items
    .filter((c) => PUBLISHED_STATUSES.includes(c.status))
    .map((c) => toContentTile(c, "published", publishedDate(c), tz, topId))
    .sort(byDateDesc)

  // Feed réel importé — verrouillé, en queue.
  const importedPosts = getImportedPosts(clientId)
  const importedAll = importedPosts.map((p) => toImportedTile(p, tz, topId)).sort(byDateDesc)

  // Épinglés (simulation) : remontés en tête de grille, comme sur le vrai profil.
  const pinned = [...publishedAll, ...importedAll].filter((t) => t.pinned).sort(byDateDesc)
  const published = publishedAll.filter((t) => !t.pinned)
  const imported = importedAll.filter((t) => !t.pinned)

  // Étagère — idées / brouillons sans date (y compris sans média).
  const shelf = items
    .filter((c) => SHELF_STATUSES.includes(c.status) && !c.scheduledAt)
    .map((c) => toContentTile(c, "scheduled", null, tz, topId))

  const igAccount = getSocialAccounts(clientId).find((a) => a.platform === "instagram") ?? null
  const quota = igAccount ? getQuotaUsage(igAccount.id) : null
  const pillars: PillarOption[] = getPillars(clientId).map((p) => ({
    id: p.id,
    label: p.name,
    colorVar: p.colorVar,
  }))

  const profile: InstagramProfileData = {
    name: client.name,
    handle: igAccount?.username ?? client.handle,
    category: client.category,
    bio: client.bio,
    avatarUrl: importedPosts[0]?.thumbUrl ?? publishedAll[0]?.media?.thumbUrl ?? "",
    postCount: publishedAll.length + importedAll.length,
    followers: igAccount?.followers ?? 0,
    following: client.following,
    highlights: importedPosts
      .slice(0, 4)
      .map((p, i) => ({ label: HIGHLIGHT_LABELS[i], cover: p.thumbUrl })),
  }

  return (
    <FeedGrid
      profile={profile}
      pinned={pinned}
      scheduled={scheduled}
      published={published}
      imported={imported}
      shelf={shelf}
      igAccount={igAccount}
      quota={quota}
      pillars={pillars}
      palette={getBrandKit(clientId)?.palette ?? []}
      reviewerName={getReviewer(clientId)?.name ?? null}
      clientId={clientId}
      tz={tz}
    />
  )
}
