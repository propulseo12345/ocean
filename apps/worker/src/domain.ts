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
  /**
   * Terminal, migration 024 : l'issue est INCONNUE — l'ancre de la règle 15
   * était posée et on n'a pas pu conclure. Distinct de `failed`, qui affirme
   * que rien n'est parti. Aucune relance automatique ne le reprend.
   */
  | "needs_verification"

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
  /**
   * Règle 15, trace d'EXÉCUTION : quand CE job a rendu la publication
   * irréversible. Jetable avec la ligne — ne jamais décider sur cette seule
   * valeur, lire `effectiveAnchor`.
   */
  publishStartedAt: Date | null
  externalContainerId: string | null
  /**
   * Règle 15, ancre de DÉCISION : `content_targets.publish_started_at`
   * (migration 023). Elle survit à la ligne de job, donc aux quatre chemins qui
   * fabriquent un job neuf pour une cible déjà partie chez la plateforme.
   */
  targetPublishStartedAt: Date | null
  targetExternalContainerId: string | null
  externalPostId: string | null
  permalink: string | null
  nextAttemptAt: Date | null
  lastError: unknown
}

/**
 * Ancre d'idempotence EFFECTIVE d'un job (RÈGLE 15). La cible fait foi : son
 * ancre est durable, celle du job ne l'est pas. `coalesce` et pas `&&` — un job
 * neuf sur une cible déjà ancrée doit hériter de l'ancre, c'est tout l'objet de
 * la migration 023.
 *
 * `containerId` sans `startedAt` est un cas normal : un conteneur créé puis un
 * crash avant la marque. Rien n'est parti, mais le conteneur est réutilisable.
 */
export function effectiveAnchor(job: PublishJob): {
  startedAt: Date | null
  containerId: string | null
} {
  return {
    startedAt: job.targetPublishStartedAt ?? job.publishStartedAt,
    containerId: job.targetExternalContainerId ?? job.externalContainerId,
  }
}

/**
 * RÈGLE 15 : l'issue de ce job est-elle INCONNUE ?
 *
 * Vrai dès que l'ancre effective est posée — la cible a peut-être reçu un POST
 * et on n'a pas pu conclure. C'est LE booléen qui décide entre `failed` (« rien
 * n'est parti », donc relançable) et `needs_verification` (« on ne sait pas »,
 * donc un humain doit regarder avant toute relance, migration 024).
 */
export function isOutcomeUnknown(job: PublishJob): boolean {
  return effectiveAnchor(job).startedAt !== null
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
