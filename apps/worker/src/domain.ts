// Types de la file de publication (miroir camelCase de la table publish_jobs,
// migration 020). Le worker est la SEULE écriture des statuts d'exécution.

export type JobStatus =
  | "scheduled"
  | "claimed"
  | "awaiting_media"
  | "publishing"
  | "retrying"
  | "succeeded"
  | "failed"
  | "dead_letter"
  | "canceled"

export type JobStep = "refresh_token" | "check_quota" | "create_container" | "publish" | "verify"

export type PublishPlatform = "instagram" | "facebook" | "tiktok"

export interface PublishJob {
  id: string
  orgId: string
  clientId: string
  contentItemId: string
  contentTargetId: string
  socialAccountId: string
  platform: PublishPlatform
  status: JobStatus
  step: JobStep | null
  runAt: Date
  attempts: number
  maxAttempts: number
  workerId: string | null
  claimedAt: Date | null
  leaseExpiresAt: Date | null
  /** Règle 15 : posé AVANT media_publish. Non nul => jamais de retry aveugle. */
  publishStartedAt: Date | null
  externalContainerId: string | null
  externalPostId: string | null
  permalink: string | null
  nextAttemptAt: Date | null
  lastError: unknown
}

/** Statut métier terminal posé sur content_targets selon la plateforme. */
export type TerminalTargetStatus = "published" | "pushed_to_platform"

/** Résultat d'une publication réussie (ou d'un brouillon TikTok poussé). */
export interface PublishResult {
  externalPostId: string
  permalink?: string
  targetStatus: TerminalTargetStatus
}

/** Erreur permanente (token révoqué, média invalide) : failed direct, aucun retry (règle 18). */
export class PermanentPublishError extends Error {
  readonly permanent = true
  constructor(message: string) {
    super(message)
    this.name = "PermanentPublishError"
  }
}

/** Le compte a perdu son autorisation : statut needs_reauth + email (règle 14). */
export class NeedsReauthError extends PermanentPublishError {
  constructor(message = "needs_reauth") {
    super(message)
    this.name = "NeedsReauthError"
  }
}
