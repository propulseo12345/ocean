// Ocean — types cœur du modèle de données (preview, données mockées)
// Miroir simplifié du modèle PRD §6. Aucune dépendance backend.
//
// i18n : les champs de TEXTE NARRATIF (bios, catégories, légendes, titres, notes…)
// sont bilingues `string`, résolus à l'affichage via field.
// Les NOMS PROPRES (name, handle, username, hashtags, email) restent en `string`
// (une agence gère des marques au nom fixe — décision du 19/06/2026).

export type Platform = "instagram" | "facebook" | "tiktok" | "newsletter" | "custom"

export type ContentFormat = "post" | "carousel" | "reel" | "story"

export type MediaType = "image" | "video"

// Statut global d'un ContentItem (PRD §5.B)
export type ContentStatus =
  | "idea"
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed"
  | "canceled"

// Statut par cible (ContentTarget)
export type TargetStatus =
  | "pending"
  | "queued"
  | "publishing"
  | "awaiting_manual"
  | "published"
  | "pushed_to_platform"
  | "failed"
  | "skipped"
  | "canceled"

export type AccountStatus = "connected" | "needs_reauth" | "expired"

export type CalendarProvider = "google" | "microsoft"

export type MemberRole = "owner" | "reviewer"

// Niveau de validation client : obligatoire (bloquant), optionnel (par contenu),
// auto (publication directe dès programmation, sans passage par le portail).
export type ApprovalMode = "required" | "optional" | "auto"

export interface Organization {
  id: string
  name: string
}

export interface User {
  id: string
  name: string
  email: string
  initials: string
  timezone: string
}

export interface Client {
  id: string
  name: string
  handle: string
  /** Teinte de marque exprimée en valeur oklch (sans hardcoder dans le JSX). */
  brandColor: string
  timezone: string
  archivedAt: string | null
  /** Bio Instagram (multiligne) — pour l'aperçu de profil. */
  bio: string
  category: string
  following: number
  approvalMode: ApprovalMode
  /** Note de collaboration interne (forfait, délais, préférences). */
  notes?: string
}

export interface SocialAccount {
  id: string
  clientId: string
  platform: Platform
  username: string
  displayName: string
  status: AccountStatus
  followers: number
}

/** Métriques d'engagement brutes d'un post (mockées). */
export interface EngagementStats {
  likes: number
  comments: number
  reach: number
  saves: number
}

export interface ImportedPost {
  id: string
  clientId: string
  thumbUrl: string
  permalink: string
  publishedAt: string
  mediaType: MediaType
  /** Métriques importées avec le post (absentes si non disponibles). */
  metrics?: EngagementStats
  /** Post épinglé en tête du profil Instagram. */
  pinned?: boolean
}

export interface MediaAsset {
  id: string
  type: MediaType
  thumbUrl: string
  fullUrl: string
  width: number
  height: number
  durationSec?: number
  position: number
  /** Texte alternatif (accessibilité + SEO social). */
  altText?: string
  /** Poids simulé en Mo — pour la validation des specs plateformes. */
  fileSizeMb?: number
  /** Type MIME simulé (ex. "image/jpeg", "image/heic", "video/mp4"). */
  mimeType?: string
}

export interface ContentTarget {
  id: string
  platform: Platform
  socialAccountId: string | null
  status: TargetStatus
  externalPostId?: string
  permalink?: string
  publishedAt?: string
  /** Légende déclinée pour cette plateforme (sinon légende commune). */
  captionOverride?: string
}

export interface ContentItem {
  id: string
  clientId: string
  title: string
  caption: string
  hashtags: string[]
  format: ContentFormat
  status: ContentStatus
  /** ISO UTC ; null tant que non daté (idea/draft sur l'étagère). */
  scheduledAt: string | null
  newsletterSubject?: string
  internalNotes?: string
  media: MediaAsset[]
  targets: ContentTarget[]
  createdAt: string
  createdBy: string
  commentsCount: number
  approvalStale?: boolean
  lastError?: string
  /** Premier commentaire Instagram (hashtags hors légende). */
  firstComment?: string
  /** Pilier éditorial (ContentPillar.id). */
  pillarId?: string
  /** Post épinglé en tête du profil (simulation grille). */
  pinned?: boolean
  /** Reel publié hors de la grille du profil Instagram. */
  excludeFromGrid?: boolean
  /** Couverture choisie pour un Reel (affichée dans la grille). */
  coverUrl?: string
  /** Corbeille : date de suppression (restaurable pendant le délai de grâce). */
  deletedAt?: string
  /** Étiquettes libres transverses (« Promo », « UGC », « Marronnier »…). */
  labels?: string[]
}

export interface CalendarAccount {
  id: string
  provider: CalendarProvider
  label: string
  email: string
  status: AccountStatus
}

export interface CalendarEvent {
  id: string
  accountId: string
  calendarName: string
  /** Couleur exprimée via une variable de thème, ex. "var(--chart-2)". */
  colorVar: string
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location?: string
  enabled: boolean
}

// Élément de l'agenda unifié (event de calendrier OU publication planifiée).
export type AgendaItem =
  | { kind: "event"; id: string; event: CalendarEvent }
  | {
      kind: "publication"
      id: string
      content: ContentItem
      client: Client
      startsAt: string
    }

export interface DashboardTask {
  id: string
  kind:
    | "publish_today"
    | "failed"
    | "review_pending"
    | "tiktok_draft"
    | "reconnect"
    | "reschedule"
    | "manual_due"
  title: string
  detail: string
  clientId?: string
  href: string
  at?: string
  tone: "info" | "warning" | "danger" | "success" | "neutral"
}
