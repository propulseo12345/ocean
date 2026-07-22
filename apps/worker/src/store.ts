import type { JobStep, PublishJob, PublishResult } from "./domain"

// Frontière de persistance de la file. Deux implémentations :
//   - PgJobStore (db/pg-store.ts) : SQL réel, connexion Supavisor SESSION.
//   - InMemoryJobStore (tests) : vérifie le moteur SANS base ni réseau.
//
// Toute écriture terminale met à jour DEUX niveaux : le job (état technique) ET
// content_targets (état métier), + recalcul du statut agrégé du content_item
// (workflow Ocean §7 : « résultat écrit sur ContentTarget ET PublishJob »).

export interface ClaimedContext {
  /** Horloge de référence = now() Postgres (jamais l'horloge du process). */
  now: Date
}

export interface JobStore {
  /** Réclame le prochain job dû (FOR UPDATE SKIP LOCKED) + pose le lease. */
  claim(workerId: string, leaseMs: number): Promise<{ job: PublishJob; now: Date } | null>

  /** Reaper : rend « retrying » les jobs dont le lease a expiré (worker mort). */
  reapExpired(): Promise<number>

  /** Prolonge le lease d'un job en cours (opération longue). */
  extendLease(jobId: string, leaseMs: number): Promise<void>

  /** Progression non terminale (étape courante, id de conteneur). */
  patchProgress(
    jobId: string,
    patch: { step?: JobStep; externalContainerId?: string }
  ): Promise<void>

  /**
   * Règle 15 : pose publish_started_at = now() AVANT media_publish, et commit.
   * Bascule aussi le content_item parent en « publishing » (état honnête).
   */
  markPublishStarted(job: PublishJob): Promise<void>

  /** Média encore en préparation côté plateforme : re-vérifier plus tard. */
  markAwaitingMedia(jobId: string, retryDelayMs: number): Promise<void>

  /** Succès (ou brouillon TikTok poussé) : job + content_target + agrégat parent. */
  succeed(job: PublishJob, result: PublishResult): Promise<void>

  /** Erreur transitoire : retry (attempts++ + backoff) ou failed si max atteint. */
  retryOrFail(job: PublishJob, error: unknown, retryDelayMs: number): Promise<void>

  /** Erreur permanente (token révoqué, média invalide) : failed direct (règle 18). */
  failPermanent(job: PublishJob, error: unknown, needsReauth: boolean): Promise<void>

  /** Fenêtre de grâce dépassée : dead_letter + notification (§5). */
  deadLetter(job: PublishJob, reason: string): Promise<void>

  /** Quota plateforme atteint : report auto au prochain créneau + notif (§5, règle 19). */
  deferForQuota(job: PublishJob, retryDelayMs: number): Promise<void>
}
