import type { PublishJob, PublishResult } from "../domain"

// Abstraction d'un publisher plateforme. Le moteur (engine.ts) orchestre ces
// étapes en respectant la règle 15 (idempotence) ; le publisher ne fait QUE
// l'appel plateforme, HORS transaction (règle : appels HTTP hors transaction).
//
// État du conteneur (modèle Instagram) : un container est créé (POST /media),
// puis publié (POST /media_publish). Le worker peut interroger son status pour
// savoir si une publication a DÉJÀ eu lieu (règle 15, reprise après crash).

export type ContainerStatus = "published" | "in_progress" | "error" | "expired"

/** Contexte fourni au publisher (token déjà rafraîchi, média résolu). */
export interface PublishContext {
  /** Token d'accès prêt à l'emploi (jamais loggé). */
  accessToken: string
  /** URL signée du média original (générée à la publication, TTL 48h). */
  mediaUrl?: string
  caption?: string
}

export interface Publisher {
  /**
   * Crée le conteneur de publication (IG : POST /media). Retourne l'id de
   * conteneur à persister AVANT publish_started_at (reprise idempotente).
   */
  createContainer(job: PublishJob, ctx: PublishContext): Promise<{ containerId: string }>

  /** Publie le conteneur (IG : POST /media_publish). Appelé APRÈS publish_started_at. */
  publish(job: PublishJob, containerId: string, ctx: PublishContext): Promise<PublishResult>

  /**
   * Règle 15 : interroge l'état du conteneur au lieu de republier à l'aveugle.
   * PUBLISHED => déjà publié, ne pas republier.
   */
  getContainerStatus(
    job: PublishJob,
    containerId: string,
    ctx: PublishContext
  ): Promise<ContainerStatus>

  /** Récupère l'id/permalink d'une publication confirmée (après PUBLISHED). */
  resolvePublished(
    job: PublishJob,
    containerId: string,
    ctx: PublishContext
  ): Promise<PublishResult>
}
