import type { PublishJob, PublishResult } from "../domain"
import type { JobMedia } from "../media/signed-urls"

/** Miroir de `public.content_format` (002). */
export type ContentFormat = "post" | "carousel" | "reel" | "story"

// Abstraction d'un publisher plateforme. Le moteur (engine.ts) orchestre ces
// étapes en respectant la règle 15 (idempotence) ; le publisher ne fait QUE
// l'appel plateforme, HORS transaction (règle : appels HTTP hors transaction).
//
// État du conteneur (modèle Instagram) : un container est créé (POST /media),
// puis publié (POST /media_publish). Le worker peut interroger son status pour
// savoir si une publication a DÉJÀ eu lieu (règle 15, reprise après crash).

/**
 * État d'un conteneur de publication, miroir de `status_code` chez Meta.
 *
 * `ready` (FINISHED chez Meta) est distinct de `published` (PUBLISHED), et la
 * distinction porte toute la règle 15 : un conteneur FINISHED est PRÊT à être
 * publié, donc rien n'est en ligne ; un conteneur PUBLISHED l'est déjà, et le
 * republier créerait le doublon. Les confondre dans un seul « ok » rendrait la
 * reprise après crash indécidable.
 *
 * ⚠ LIMITE CONNUE ET NON FERMABLE ICI : entre l'acceptation d'un
 * `media_publish` par Meta et le passage du conteneur à PUBLISHED, il existe
 * une fenêtre où le statut lu vaut encore FINISHED. C'est précisément pourquoi
 * `needs_verification` (024) existe : on ne prétend pas trancher, on dit qu'on
 * ne sait pas.
 */
export type ContainerStatus = "published" | "ready" | "in_progress" | "error" | "expired"

/** Contexte fourni au publisher (token déjà rafraîchi, média résolu). */
export interface PublishContext {
  /** Token d'accès prêt à l'emploi (jamais loggé). */
  accessToken: string
  /**
   * Identifiant du compte CHEZ la plateforme (ig-user-id, page-id, open_id).
   * Le job ne transporte que des uuid Ocean : sans cette valeur, un publisher
   * ne peut même pas composer l'URL de son appel.
   */
  providerAccountId: string
  /**
   * Médias du contenu, URL signées 48 h, DANS L'ORDRE du carrousel
   * (content_media.position). Vide est un cas légitime — un post Facebook peut
   * n'être que du texte — et c'est au publisher de décider si sa plateforme
   * l'accepte, pas au contexte.
   *
   * ⚠ Chaque `url` est un SECRET (JWT de 48 h sur un fichier client) : jamais
   * journalisée, jamais recopiée dans un message d'erreur.
   */
  media: JobMedia[]
  /** Légende finale, hashtags réinjectés (db/publish-target.ts). */
  caption: string
  /** `content_items.format` — c'est lui qui distingue un reel d'une image. */
  format: ContentFormat
  /** Premier commentaire Instagram (posté après la publication). */
  firstComment?: string | null
  /**
   * Signal d'annulation à passer à `fetch` (phase 6). Le moteur borne déjà
   * chaque appel dans le temps (`withTimeout`), mais une course de promesses
   * rend seulement la main : sans ce signal, la requête HTTP continue de vivre
   * en tâche de fond, socket et token compris. Les publishers réels DOIVENT le
   * transmettre.
   */
  signal?: AbortSignal
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
