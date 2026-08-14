import type { JobStep, PublishJob, PublishResult } from "./domain"

// Frontière de persistance de la file. Deux implémentations :
//   - PgJobStore (db/pg-store.ts) : SQL réel, connexion Supavisor SESSION.
//   - InMemoryJobStore (tests) : vérifie le moteur SANS base ni réseau.
//
// Toute écriture terminale met à jour DEUX niveaux : le job (état technique) ET
// content_targets (état métier), + recalcul du statut agrégé du content_item
// (workflow Ocean §7 : « résultat écrit sur ContentTarget ET PublishJob »).
//
// JETON DE CLÔTURE (fencing, P3-5) — TOUTE écriture d'état porte
// `and worker_id = <le nôtre>` et vérifie `rowCount`. 0 ligne touchée => le job
// ne nous appartient plus (lease expiré et repris, ou job annulé) => on lève
// `LeaseLostError` et on s'arrête sans publier ni écrire. C'est ce qui rend la
// file sûre à plus d'une instance, et ce qui rend une déprogrammation effective
// sur un job déjà réclamé.

/** Ce que le reaper a fait de son passage. */
export interface ReapResult {
  /** Jobs rendus à la file pour une nouvelle tentative. */
  requeued: number
  /** Jobs à bout de tentatives, clos définitivement (dead_letter / needs_verification). */
  terminalized: number
}

export interface ClaimedContext {
  /** Horloge de référence = now() Postgres (jamais l'horloge du process). */
  now: Date
}

export interface JobStore {
  /** Réclame le prochain job dû (FOR UPDATE SKIP LOCKED) + pose le lease. */
  claim(workerId: string, leaseMs: number): Promise<{ job: PublishJob; now: Date } | null>

  /**
   * Reaper : rend « retrying » les jobs dont le lease a expiré (worker mort),
   * et TERMINALISE ceux qui n'ont plus de tentative. Sans ce second geste, un
   * job à bout de tentatives reste `claimed` à vie, gèle sa cible via l'index
   * unique partiel, et laisse le contenu en `publishing` — statut sans sortie.
   */
  reapExpired(): Promise<ReapResult>

  /**
   * Prolonge le lease d'un job en cours (opération longue).
   * `false` = lease perdu (le job appartient à un autre worker) : l'appelant
   * doit interrompre le traitement. Ne lève pas — c'est un heartbeat de fond.
   */
  extendLease(job: PublishJob, leaseMs: number): Promise<boolean>

  /**
   * Progression non terminale (étape courante, id de conteneur). Le conteneur
   * est écrit sur le job ET sur la cible : c'est la cible qui doit rester
   * interrogeable si la ligne de job disparaît (migration 023).
   */
  patchProgress(
    job: PublishJob,
    patch: { step?: JobStep; externalContainerId?: string }
  ): Promise<void>

  /**
   * Règle 15 : pose publish_started_at = now() AVANT media_publish, et commit.
   * L'ancre est posée sur le JOB (trace) et sur la CIBLE (décision, migration
   * 023) dans une seule transaction — une ancre posée sur le job seul serait
   * perdue au premier réenfilement. Bascule aussi le content_item parent en
   * « publishing » (état honnête).
   */
  markPublishStarted(job: PublishJob, containerId: string): Promise<void>

  /** Média encore en préparation côté plateforme : re-vérifier plus tard. */
  markAwaitingMedia(job: PublishJob, retryDelayMs: number): Promise<void>

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
