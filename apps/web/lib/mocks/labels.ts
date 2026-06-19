import type { MessageKey } from "@/lib/i18n"
import { CONTENT_PILLARS } from "./pillars"
import type {
  AccountStatus,
  ActivityKind,
  ApprovalMode,
  ContentFormat,
  ContentStatus,
  Platform,
  ReviewRequestState,
  TargetStatus,
} from "./types"

export type StatusTone = "success" | "warning" | "info" | "danger" | "neutral" | "brand"

// Méta locale-indépendante : tonalité + clé de libellé i18n (résolue via t(labelKey)).
interface Meta {
  labelKey: MessageKey
  tone: StatusTone
}

export const contentStatusMeta: Record<ContentStatus, Meta> = {
  idea: { labelKey: "status.content.idea", tone: "neutral" },
  draft: { labelKey: "status.content.draft", tone: "neutral" },
  in_review: { labelKey: "status.content.in_review", tone: "warning" },
  changes_requested: { labelKey: "status.content.changes_requested", tone: "danger" },
  approved: { labelKey: "status.content.approved", tone: "success" },
  scheduled: { labelKey: "status.content.scheduled", tone: "info" },
  publishing: { labelKey: "status.content.publishing", tone: "info" },
  published: { labelKey: "status.content.published", tone: "success" },
  partially_published: { labelKey: "status.content.partially_published", tone: "warning" },
  failed: { labelKey: "status.content.failed", tone: "danger" },
  canceled: { labelKey: "status.content.canceled", tone: "neutral" },
}

export const targetStatusMeta: Record<TargetStatus, Meta> = {
  pending: { labelKey: "status.target.pending", tone: "neutral" },
  queued: { labelKey: "status.target.queued", tone: "info" },
  publishing: { labelKey: "status.target.publishing", tone: "info" },
  awaiting_manual: { labelKey: "status.target.awaiting_manual", tone: "warning" },
  published: { labelKey: "status.target.published", tone: "success" },
  pushed_to_platform: { labelKey: "status.target.pushed_to_platform", tone: "warning" },
  failed: { labelKey: "status.target.failed", tone: "danger" },
  skipped: { labelKey: "status.target.skipped", tone: "neutral" },
  canceled: { labelKey: "status.target.canceled", tone: "neutral" },
}

export const accountStatusMeta: Record<AccountStatus, Meta> = {
  connected: { labelKey: "status.account.connected", tone: "success" },
  needs_reauth: { labelKey: "status.account.needs_reauth", tone: "warning" },
  expired: { labelKey: "status.account.expired", tone: "danger" },
}

export const reviewStateMeta: Record<ReviewRequestState, Meta> = {
  pending: { labelKey: "status.review.pending", tone: "warning" },
  partial: { labelKey: "status.review.partial", tone: "info" },
  done: { labelKey: "status.review.done", tone: "success" },
}

export const approvalModeMeta: Record<ApprovalMode, Meta> = {
  required: { labelKey: "status.approval.required", tone: "warning" },
  optional: { labelKey: "status.approval.optional", tone: "info" },
  auto: { labelKey: "status.approval.auto", tone: "success" },
}

export const activityKindMeta: Record<ActivityKind, Meta> = {
  created: { labelKey: "status.activity.created", tone: "neutral" },
  updated: { labelKey: "status.activity.updated", tone: "neutral" },
  sent_for_review: { labelKey: "status.activity.sent_for_review", tone: "info" },
  commented: { labelKey: "status.activity.commented", tone: "info" },
  approved: { labelKey: "status.activity.approved", tone: "success" },
  changes_requested: { labelKey: "status.activity.changes_requested", tone: "warning" },
  scheduled: { labelKey: "status.activity.scheduled", tone: "info" },
  rescheduled: { labelKey: "status.activity.rescheduled", tone: "info" },
  published: { labelKey: "status.activity.published", tone: "success" },
  failed: { labelKey: "status.activity.failed", tone: "danger" },
  retried: { labelKey: "status.activity.retried", tone: "warning" },
}

// Méta des piliers éditoriaux par id (le nom est du contenu démo bilingue, résolu ailleurs).
export const pillarMeta: Record<string, { colorVar: string }> = Object.fromEntries(
  CONTENT_PILLARS.map((p) => [p.id, { colorVar: p.colorVar }])
)

// Libellé i18n d'un format (le nom propre des plateformes n'est pas traduit).
export const formatLabelKey: Record<ContentFormat, MessageKey> = {
  post: "format.post",
  carousel: "format.carousel",
  reel: "format.reel",
  story: "format.story",
}

export const platformMeta: Record<Platform, { label: string; short: string; colorVar: string }> = {
  instagram: { label: "Instagram", short: "IG", colorVar: "var(--instagram)" },
  facebook: { label: "Facebook", short: "FB", colorVar: "var(--facebook)" },
  tiktok: { label: "TikTok", short: "TT", colorVar: "var(--tiktok)" },
  newsletter: { label: "Newsletter", short: "NL", colorVar: "var(--newsletter)" },
  // « Sur mesure » / « Custom » est le seul libellé plateforme traduisible.
  custom: { label: "—", short: "SM", colorVar: "var(--custom)" },
}

// Clé i18n du libellé « Sur mesure » (platformMeta.custom.label est un placeholder).
export const customPlatformLabelKey: MessageKey = "platform.custom"

// Pastille de couleur par tonalité (texte neutre, lisible dans les 2 thèmes).
export const toneDotClass: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  brand: "bg-primary",
}

export const toneTextClass: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
  brand: "text-primary",
}

// Plateformes réellement gérées par une cible (les "manuelles" sont à part).
export const API_PLATFORMS: Platform[] = ["instagram", "facebook", "tiktok"]
export const MANUAL_PLATFORMS: Platform[] = ["newsletter", "custom"]
