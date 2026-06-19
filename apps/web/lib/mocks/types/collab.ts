// Ocean — types de collaboration : validation client, commentaires,
// notifications, versions et journal d'activité.

import type { L } from "@/lib/i18n/localized"
import type { MemberRole } from "./core"

export interface Reviewer {
  id: string
  clientId: string
  name: string
  email: string
  initials: string
  lastActiveAt: string | null
}

export type ApprovalDecision = "approved" | "changes_requested"

export interface Approval {
  id: string
  contentId: string
  reviewerId: string
  decision: ApprovalDecision
  message?: L<string>
  versionLabel: string
  createdAt: string
}

export interface Annotation {
  mediaAssetId: string
  slideIndex: number
  x: number
  y: number
}

export interface Comment {
  id: string
  contentId: string
  authorName: string
  role: MemberRole
  body: L<string>
  createdAt: string
  annotation?: Annotation
}

export type ReviewRequestState = "pending" | "partial" | "done"

export interface ReviewRequest {
  id: string
  clientId: string
  contentIds: string[]
  reviewerIds: string[]
  message?: L<string>
  sentAt: string
  state: ReviewRequestState
}

export type NotificationChannel = "in_app" | "push" | "email"
export type NotificationAudience = "owner" | "reviewer" | "ops"

export interface AppNotification {
  id: string
  type: string
  title: L<string>
  body: L<string>
  channels: NotificationChannel[]
  audience: NotificationAudience
  read: boolean
  createdAt: string
  href: string
}

/** Snapshot d'une version envoyée en validation (v1, v2…). */
export interface ContentVersion {
  id: string
  contentId: string
  /** Libellé court : "v1", "v2"… */
  label: string
  caption: L<string>
  /** Ce qui a motivé cette version (retour client, correction…). */
  note: L<string>
  createdAt: string
}

export type ActivityKind =
  | "created"
  | "updated"
  | "sent_for_review"
  | "commented"
  | "approved"
  | "changes_requested"
  | "scheduled"
  | "rescheduled"
  | "published"
  | "failed"
  | "retried"

/** Entrée du journal d'activité d'un contenu (qui, quoi, quand). */
export interface ActivityEntry {
  id: string
  contentId: string
  at: string
  /** Nom de l'acteur — "Ocean" pour les événements système (worker). */
  actorName: string
  kind: ActivityKind
  detail: L<string>
}
