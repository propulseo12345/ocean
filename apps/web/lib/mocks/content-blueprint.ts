import type { ContentFormat, ContentStatus, Platform } from "./types"

export interface Blueprint {
  status: ContentStatus
  format: ContentFormat
  platforms: Platform[]
  day: number | null
  hour: number
  media: number
}

// Une timeline éditoriale type, rejouée pour chaque client (filtrée selon les
// comptes réellement connectés). Couvre tout le spectre de la machine à états.
export const BLUEPRINT: Blueprint[] = [
  {
    status: "published",
    format: "post",
    platforms: ["instagram", "facebook"],
    day: -12,
    hour: 8,
    media: 1,
  },
  {
    status: "published",
    format: "carousel",
    platforms: ["instagram"],
    day: -9,
    hour: 17,
    media: 3,
  },
  {
    status: "published",
    format: "reel",
    platforms: ["instagram", "facebook"],
    day: -6,
    hour: 12,
    media: 1,
  },
  { status: "published", format: "post", platforms: ["instagram"], day: -4, hour: 10, media: 1 },
  {
    status: "partially_published",
    format: "post",
    platforms: ["instagram", "facebook"],
    day: -2,
    hour: 9,
    media: 1,
  },
  { status: "failed", format: "reel", platforms: ["instagram"], day: -1, hour: 19, media: 1 },
  { status: "publishing", format: "reel", platforms: ["tiktok"], day: 0, hour: 6, media: 1 },
  {
    status: "scheduled",
    format: "post",
    platforms: ["instagram", "facebook"],
    day: 0,
    hour: 16,
    media: 1,
  },
  { status: "scheduled", format: "carousel", platforms: ["instagram"], day: 1, hour: 11, media: 4 },
  {
    status: "scheduled",
    format: "reel",
    platforms: ["instagram", "tiktok"],
    day: 2,
    hour: 18,
    media: 1,
  },
  { status: "approved", format: "story", platforms: ["instagram"], day: 1, hour: 7, media: 1 },
  {
    status: "in_review",
    format: "post",
    platforms: ["instagram", "facebook"],
    day: 3,
    hour: 12,
    media: 1,
  },
  { status: "in_review", format: "carousel", platforms: ["instagram"], day: 4, hour: 17, media: 3 },
  {
    status: "changes_requested",
    format: "reel",
    platforms: ["instagram", "tiktok"],
    day: 5,
    hour: 9,
    media: 1,
  },
  { status: "scheduled", format: "post", platforms: ["newsletter"], day: 6, hour: 9, media: 0 },
  {
    status: "draft",
    format: "post",
    platforms: ["instagram", "facebook"],
    day: null,
    hour: 9,
    media: 1,
  },
  { status: "idea", format: "carousel", platforms: ["instagram"], day: null, hour: 9, media: 0 },
]
