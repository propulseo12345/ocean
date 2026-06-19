import { CLIENTS, SOCIAL_ACCOUNTS } from "./clients"
import { BLUEPRINT, type Blueprint } from "./content-blueprint"
import {
  CONTENT_OVERRIDES,
  contentExtras,
  EXTRA_CONTENT_ITEMS,
  TARGET_CAPTION_OVERRIDES,
} from "./content-extra"
import { COPY_POOL } from "./copy"
import { IMAGES } from "./images"
import { dayAt } from "./time"
import type {
  Client,
  ContentFormat,
  ContentItem,
  ContentStatus,
  ContentTarget,
  MediaAsset,
  MediaType,
  Platform,
  TargetStatus,
} from "./types"

const SUCCESS: TargetStatus[] = ["published", "pushed_to_platform"]
const PREPUBLISH: ContentStatus[] = [
  "idea",
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "canceled",
]

function buildMedia(
  client: Client,
  seed: number,
  count: number,
  format: ContentFormat
): MediaAsset[] {
  const pool = IMAGES[client.theme]
  const vertical = format === "reel" || format === "story"
  const out: MediaAsset[] = []
  for (let j = 0; j < count; j++) {
    const url = pool[(seed * 3 + j) % pool.length]
    const type: MediaType = j === 0 && format === "reel" ? "video" : "image"
    out.push({
      id: `md_${client.id}_${seed}_${j}`,
      type,
      thumbUrl: url,
      fullUrl: url,
      width: 1080,
      height: vertical ? 1920 : 1080,
      durationSec: type === "video" ? 18 : undefined,
      position: j,
      fileSizeMb: type === "video" ? 42 : 2.4,
      mimeType: type === "video" ? "video/mp4" : "image/jpeg",
    })
  }
  return out
}

function assignTargetStatus(status: ContentStatus, platform: Platform, idx: number): TargetStatus {
  const manual = platform === "newsletter" || platform === "custom"
  switch (status) {
    case "published":
      return "published"
    case "partially_published":
      return idx === 0 ? "published" : "failed"
    case "failed":
      return "failed"
    case "publishing":
      return platform === "tiktok" ? "pushed_to_platform" : "published"
    case "scheduled":
      return manual ? "pending" : "queued"
    default:
      return "pending"
  }
}

function deriveStatus(status: ContentStatus, targets: ContentTarget[]): ContentStatus {
  if (PREPUBLISH.includes(status)) return status
  const inS = targets.filter((t) => SUCCESS.includes(t.status))
  const failed = targets.filter((t) => t.status === "failed")
  if (inS.length === targets.length) {
    return targets.some((t) => t.status === "pushed_to_platform") ? "publishing" : "published"
  }
  if (inS.length > 0 && failed.length > 0) return "partially_published"
  if (failed.length === targets.length) return "failed"
  return "publishing"
}

function buildTargets(bp: Blueprint, client: Client, contentId: string): ContentTarget[] {
  const accounts = SOCIAL_ACCOUNTS.filter((a) => a.clientId === client.id)
  type Resolved = { platform: Platform; accountId: string | null }
  const resolved: Resolved[] = bp.platforms
    .map((p): Resolved | null => {
      if (p === "newsletter" || p === "custom") return { platform: p, accountId: null }
      const acc = accounts.find((a) => a.platform === p)
      return acc ? { platform: p, accountId: acc.id } : null
    })
    .filter((r): r is Resolved => r !== null)

  if (resolved.length === 0) {
    const ig = accounts.find((a) => a.platform === "instagram")
    if (ig) resolved.push({ platform: "instagram", accountId: ig.id })
  }

  return resolved.map((r, idx) => {
    const tStatus = assignTargetStatus(bp.status, r.platform, idx)
    const success = SUCCESS.includes(tStatus)
    return {
      id: `tg_${contentId}_${r.platform}`,
      platform: r.platform,
      socialAccountId: r.accountId,
      status: tStatus,
      externalPostId: success ? `${r.platform}_${contentId}` : undefined,
      permalink: tStatus === "published" ? `https://${r.platform}.com/p/${contentId}` : undefined,
      publishedAt: success && bp.day !== null ? dayAt(bp.day, bp.hour) : undefined,
      captionOverride: TARGET_CAPTION_OVERRIDES[contentId]?.[r.platform],
    }
  })
}

function buildClientContent(client: Client): ContentItem[] {
  const pool = COPY_POOL[client.theme]
  const accounts = SOCIAL_ACCOUNTS.filter((a) => a.clientId === client.id)
  const hasTikTok = accounts.some((a) => a.platform === "tiktok")
  const items: ContentItem[] = []

  BLUEPRINT.forEach((bp, i) => {
    if (bp.status === "publishing" && bp.platforms[0] === "tiktok" && !hasTikTok) return
    const id = `ct_${client.id}_${i}`
    const copy = pool[i % pool.length]
    const targets = buildTargets(bp, client, id)
    const status = deriveStatus(bp.status, targets)
    const isManual = bp.platforms.includes("newsletter")
    const commentsCount =
      status === "changes_requested"
        ? 3
        : status === "in_review"
          ? 2
          : status === "approved"
            ? 1
            : 0

    items.push({
      id,
      clientId: client.id,
      title: copy.title,
      caption: copy.caption,
      hashtags: copy.hashtags,
      format: bp.format,
      status,
      scheduledAt: bp.day === null ? null : dayAt(bp.day, bp.hour),
      newsletterSubject: isManual ? copy.title : undefined,
      internalNotes: i % 5 === 0 ? "Penser à taguer le lieu et le partenaire." : undefined,
      media: buildMedia(client, i, bp.media, bp.format),
      targets,
      createdAt: dayAt(bp.day === null ? -8 : bp.day - 3, 9),
      createdBy: "usr_etienne",
      commentsCount,
      approvalStale: status === "changes_requested" && i % 2 === 0 ? true : undefined,
      lastError:
        status === "failed"
          ? "Token expiré : reconnecte le compte Instagram."
          : status === "partially_published"
            ? "Facebook : média refusé (ratio non conforme)."
            : undefined,
      ...contentExtras(i, client.id),
      ...CONTENT_OVERRIDES[id],
    })
  })

  return items
}

// Tous les contenus, corbeille incluse (filtrée par getContentItems).
export const CONTENT_ITEMS: ContentItem[] = [
  ...CLIENTS.filter((c) => !c.archivedAt).flatMap(buildClientContent),
  ...EXTRA_CONTENT_ITEMS,
]
