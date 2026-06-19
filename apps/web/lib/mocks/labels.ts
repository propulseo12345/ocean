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

interface Meta {
  label: string
  tone: StatusTone
}

export const contentStatusMeta: Record<ContentStatus, Meta> = {
  idea: { label: "Idée", tone: "neutral" },
  draft: { label: "Brouillon", tone: "neutral" },
  in_review: { label: "En revue", tone: "warning" },
  changes_requested: { label: "Modifs demandées", tone: "danger" },
  approved: { label: "Approuvé", tone: "success" },
  scheduled: { label: "Programmé", tone: "info" },
  publishing: { label: "Publication…", tone: "info" },
  published: { label: "Publié", tone: "success" },
  partially_published: { label: "Partiellement publié", tone: "warning" },
  failed: { label: "Échec", tone: "danger" },
  canceled: { label: "Annulé", tone: "neutral" },
}

export const targetStatusMeta: Record<TargetStatus, Meta> = {
  pending: { label: "En attente", tone: "neutral" },
  queued: { label: "En file", tone: "info" },
  publishing: { label: "Publication…", tone: "info" },
  awaiting_manual: { label: "À publier manuellement", tone: "warning" },
  published: { label: "Publié", tone: "success" },
  pushed_to_platform: { label: "Brouillon poussé", tone: "warning" },
  failed: { label: "Échec", tone: "danger" },
  skipped: { label: "Ignoré", tone: "neutral" },
  canceled: { label: "Annulé", tone: "neutral" },
}

export const accountStatusMeta: Record<AccountStatus, Meta> = {
  connected: { label: "Connecté", tone: "success" },
  needs_reauth: { label: "Reconnexion requise", tone: "warning" },
  expired: { label: "Expiré", tone: "danger" },
}

export const reviewStateMeta: Record<ReviewRequestState, Meta> = {
  pending: { label: "En attente", tone: "warning" },
  partial: { label: "Partiellement traité", tone: "info" },
  done: { label: "Traité", tone: "success" },
}

export const approvalModeMeta: Record<ApprovalMode, Meta> = {
  required: { label: "Validation obligatoire", tone: "warning" },
  optional: { label: "Validation optionnelle", tone: "info" },
  auto: { label: "Publication directe", tone: "success" },
}

export const activityKindMeta: Record<ActivityKind, Meta> = {
  created: { label: "Créé", tone: "neutral" },
  updated: { label: "Modifié", tone: "neutral" },
  sent_for_review: { label: "Envoyé en validation", tone: "info" },
  commented: { label: "Commenté", tone: "info" },
  approved: { label: "Approuvé", tone: "success" },
  changes_requested: { label: "Modifs demandées", tone: "warning" },
  scheduled: { label: "Programmé", tone: "info" },
  rescheduled: { label: "Reprogrammé", tone: "info" },
  published: { label: "Publié", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
  retried: { label: "Nouvelle tentative", tone: "warning" },
}

// Méta des piliers éditoriaux par id (label + couleur de thème).
export const pillarMeta: Record<string, { label: string; colorVar: string }> = Object.fromEntries(
  CONTENT_PILLARS.map((p) => [p.id, { label: p.name, colorVar: p.colorVar }])
)

export const formatMeta: Record<ContentFormat, { label: string }> = {
  post: { label: "Post" },
  carousel: { label: "Carrousel" },
  reel: { label: "Reel" },
  story: { label: "Story" },
}

export const platformMeta: Record<Platform, { label: string; short: string; colorVar: string }> = {
  instagram: { label: "Instagram", short: "IG", colorVar: "var(--instagram)" },
  facebook: { label: "Facebook", short: "FB", colorVar: "var(--facebook)" },
  tiktok: { label: "TikTok", short: "TT", colorVar: "var(--tiktok)" },
  newsletter: {
    label: "Newsletter",
    short: "NL",
    colorVar: "var(--newsletter)",
  },
  custom: { label: "Sur mesure", short: "SM", colorVar: "var(--custom)" },
}

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
