import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FeedGrid } from "@/components/app/grid/feed-grid"
import type { GridTileData, PillarOption } from "@/components/app/grid/grid-types"
import type { InstagramProfileData } from "@/components/app/grid/instagram-profile-header"
import { getActiveOrg } from "@/lib/auth/org-context"
import {
  getBrandKit,
  getClient,
  getContentItems,
  getImportedPosts,
  getPillars,
  getPostMetricsBatch,
  getQuotaUsage,
  getReviewer,
  getSocialAccounts,
  getTopPosts,
} from "@/lib/data"
import type {
  ContentItem,
  EngagementStats,
  ImportedPost,
  MediaAsset,
  PostMetrics,
} from "@/lib/domain"
import type { Format, Translator } from "@/lib/i18n"
import { getFormat, getT } from "@/lib/i18n/server"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaGrid") }
}

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

function inFeed(c: ContentItem): boolean {
  if (c.format === "story") return false
  return c.targets.some((t) => t.platform === "instagram")
}

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

function metricsOf(
  metrics: Map<string, PostMetrics | undefined>,
  refId: string
): EngagementStats | undefined {
  const m = metrics.get(refId)
  return m ? { likes: m.likes, comments: m.comments, reach: m.reach, saves: m.saves } : undefined
}

function toContentTile(
  c: ContentItem,
  group: GridTileData["group"],
  dateIso: string | null,
  tz: string,
  topId: string | undefined,
  metrics: Map<string, PostMetrics | undefined>
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
    lastError: c.lastError ? c.lastError : undefined,
    metrics: metricsOf(metrics, c.id),
    isTopPost: topId === c.id,
  }
}

function toImportedTile(
  post: ImportedPost,
  tz: string,
  topId: string | undefined,
  t: Translator,
  f: Format
): GridTileData {
  return {
    id: post.id,
    group: "imported",
    media: placeholderMedia(post),
    mediaCount: 1,
    format: post.mediaType === "video" ? "reel" : "post",
    title: t("clients.importedPostTitle", { date: f.dayMonth(post.publishedAt, tz) }),
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
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client) notFound()

  const t = await getT()
  const f = await getFormat()
  const tz = client.timezone
  const topId = (await getTopPosts(ctx.org.id, clientId, 1))[0]?.refId

  const items = (await getContentItems(ctx.org.id, clientId)).filter(inFeed)
  // Une seule requête pour toutes les tuiles (fin du N+1 : un getPostMetrics/tuile).
  const metrics = await getPostMetricsBatch(
    ctx.org.id,
    items.map((item) => item.id)
  )

  const scheduled = items
    .filter((c) => PLANNED_STATUSES.includes(c.status) && c.scheduledAt)
    .map((c) => toContentTile(c, "scheduled", c.scheduledAt, tz, topId, metrics))
    .sort(byDateDesc)

  const publishedAll = items
    .filter((c) => PUBLISHED_STATUSES.includes(c.status))
    .map((c) => toContentTile(c, "published", publishedDate(c), tz, topId, metrics))
    .sort(byDateDesc)

  const importedPosts = await getImportedPosts(ctx.org.id, clientId)
  const importedAll = importedPosts.map((p) => toImportedTile(p, tz, topId, t, f)).sort(byDateDesc)

  const pinned = [...publishedAll, ...importedAll].filter((tile) => tile.pinned).sort(byDateDesc)
  const published = publishedAll.filter((tile) => !tile.pinned)
  const imported = importedAll.filter((tile) => !tile.pinned)

  const shelf = items
    .filter((c) => SHELF_STATUSES.includes(c.status) && !c.scheduledAt)
    .map((c) => toContentTile(c, "scheduled", null, tz, topId, metrics))

  const igAccount =
    (await getSocialAccounts(ctx.org.id, clientId)).find((a) => a.platform === "instagram") ?? null
  const quota = igAccount ? await getQuotaUsage(ctx.org.id, igAccount.id) : null
  const pillars: PillarOption[] = (await getPillars(ctx.org.id, clientId)).map((p) => ({
    id: p.id,
    label: p.name,
    colorVar: p.colorVar,
  }))

  const highlightLabels = [
    t("clients.highlightNouveautes"),
    t("clients.highlightCoulisses"),
    t("clients.highlightAvis"),
    t("clients.highlightEquipe"),
  ]

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
      .map((p, i) => ({ label: highlightLabels[i], cover: p.thumbUrl })),
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
      palette={(await getBrandKit(ctx.org.id, clientId))?.palette ?? []}
      reviewerName={(await getReviewer(ctx.org.id, clientId))?.name ?? null}
      clientId={clientId}
      tz={tz}
    />
  )
}
