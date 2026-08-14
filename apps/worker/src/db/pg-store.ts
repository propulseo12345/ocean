import type pg from "pg"
import {
  isOutcomeUnknown,
  type JobStep,
  LeaseLostError,
  type PublishJob,
  type PublishResult,
} from "../domain"
import { log } from "../log"
import { LOCAL_QUOTAS } from "../quota"
import type { JobStore, ReapResult } from "../store"

// Implémentation Postgres de la file (Supavisor SESSION). L'horloge est now()
// Postgres (règle 17). Les écritures terminales touchent DEUX niveaux dans une
// transaction : le job (technique) ET content_targets (métier) + agrégat parent.

const JOB_COLUMNS = `
  id, org_id, client_id, content_item_id, content_target_id, social_account_id,
  platform, status, step, run_at, attempts, max_attempts, worker_id, claimed_at,
  lease_expires_at, publish_started_at, external_container_id, external_post_id,
  permalink, next_attempt_at, last_error`

// Ancre d'idempotence DURABLE, lue sur la cible au claim (migration 023). Elle
// est ce qui distingue « ce job n'a rien envoyé » de « cette cible a peut-être
// déjà reçu un POST » — un job neuf ne peut plus effacer la seconde information.
const TARGET_ANCHOR_COLUMNS = `
  ct.publish_started_at    as target_publish_started_at,
  ct.external_container_id as target_external_container_id`

type Row = Record<string, unknown>

function rowToJob(r: Row): PublishJob {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    clientId: r.client_id as string,
    contentItemId: r.content_item_id as string,
    contentTargetId: r.content_target_id as string,
    socialAccountId: r.social_account_id as string,
    platform: r.platform as PublishJob["platform"],
    status: r.status as PublishJob["status"],
    step: r.step as JobStep | null,
    runAt: r.run_at as Date,
    attempts: r.attempts as number,
    maxAttempts: r.max_attempts as number,
    workerId: r.worker_id as string | null,
    claimedAt: r.claimed_at as Date | null,
    leaseExpiresAt: r.lease_expires_at as Date | null,
    publishStartedAt: r.publish_started_at as Date | null,
    externalContainerId: r.external_container_id as string | null,
    targetPublishStartedAt: (r.target_publish_started_at ?? null) as Date | null,
    targetExternalContainerId: (r.target_external_container_id ?? null) as string | null,
    externalPostId: r.external_post_id as string | null,
    permalink: r.permalink as string | null,
    nextAttemptAt: r.next_attempt_at as Date | null,
    lastError: r.last_error ?? null,
  }
}

function errorJson(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : "unknown"
  return JSON.stringify({ error: name, detail })
}

/**
 * Contexte minimal d'un job pour les logs. Que des identifiants et le statut :
 * aucun token, aucune légende, aucune donnée client (règle 12, et §10 « aucun
 * secret loggé »). Le moteur d'états était totalement muet — impossible de savoir
 * a posteriori si 2 % ou 30 % des publications échouaient, donc impossible de
 * prioriser quoi que ce soit.
 */
function jobFields(job: PublishJob): Record<string, unknown> {
  return {
    jobId: job.id,
    orgId: job.orgId,
    clientId: job.clientId,
    contentItemId: job.contentItemId,
    contentTargetId: job.contentTargetId,
    socialAccountId: job.socialAccountId,
    platform: job.platform,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
  }
}

/**
 * Statuts dans lesquels le job est ENTRE NOS MAINS. Toute écriture d'état les
 * exige : un job qui n'y est plus a été repris par le reaper (donc par un autre
 * worker) ou annulé par l'app (P3-9). Dans les deux cas nous n'avons plus le
 * droit d'écrire.
 */
const OWNED_STATUSES = "('claimed', 'publishing')"

/**
 * JETON DE CLÔTURE. `rowCount === 0` sur une écriture fencée ne veut pas dire
 * « rien à faire » : ça veut dire « ce job ne nous appartient plus ». Le laisser
 * passer, comme le faisait le code d'origine, permet à un worker zombie
 * d'écraser le travail de celui qui a repris le job — et, avant
 * `markPublishStarted`, de publier une seconde fois.
 */
function assertOwned(rowCount: number | null, operation: string): void {
  if ((rowCount ?? 0) === 0) throw new LeaseLostError(operation)
}

export class PgJobStore implements JobStore {
  constructor(private readonly pool: pg.Pool) {}

  async claim(workerId: string, leaseMs: number): Promise<{ job: PublishJob; now: Date } | null> {
    // Claim atomique : un seul job dû est verrouillé (SKIP LOCKED => plusieurs
    // workers ne se battent pas), passé « claimed », lease posé.
    const sql = `
      with claimed as (
        update public.publish_jobs
        set status = 'claimed', worker_id = $1, claimed_at = now(),
            lease_expires_at = now() + make_interval(secs => $2::double precision / 1000)
        where id = (
          select id from public.publish_jobs
          where status in ('scheduled', 'retrying', 'awaiting_media')
            and run_at <= now()
            and (next_attempt_at is null or next_attempt_at <= now())
          order by run_at
          for update skip locked
          limit 1
        )
        returning ${JOB_COLUMNS}
      )
      select claimed.*, ${TARGET_ANCHOR_COLUMNS}, now() as _now
      from claimed
      join public.content_targets ct on ct.id = claimed.content_target_id`
    const { rows } = await this.pool.query(sql, [workerId, leaseMs])
    const row = rows[0]
    if (!row) return null
    return { job: rowToJob(row), now: row._now as Date }
  }

  async reapExpired(): Promise<ReapResult> {
    // Reaper : un job dont le lease a expiré (worker mort en cours) redevient
    // « retrying » pour re-claim. attempts++ borne les boucles.
    const requeue = await this.pool.query(
      `update public.publish_jobs
       set status = 'retrying', attempts = attempts + 1,
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now()
       where status in ('claimed', 'publishing')
         and lease_expires_at is not null and lease_expires_at < now()
         and attempts < max_attempts`
    )
    const terminalized = await this.terminalizeExhausted()
    return { requeued: requeue.rowCount ?? 0, terminalized }
  }

  /**
   * Jobs à bout de tentatives ET à lease expiré. La clause `attempts <
   * max_attempts` du requeue les laissait `claimed`/`publishing` À VIE : le
   * commentaire d'origine les renvoyait « au watchdog pg_cron », qui n'existe
   * pas. Conséquences en chaîne : l'index unique partiel des statuts actifs
   * (020:115) gelait la cible — plus aucun job ne pouvait être enfilé pour elle —
   * et `content_items` restait bloqué en `publishing`, un statut d'où la matrice
   * 016 n'autorise AUCUNE transition à `authenticated`. Contenu mort, cible
   * morte, sans un seul message.
   *
   * L'issue posée dépend de l'ancre, comme partout ailleurs (024) : `dead_letter`
   * quand on sait que rien n'est parti, `needs_verification` sinon. Le reaper est
   * justement le cas où l'on ne PEUT pas savoir — le worker qui traitait ce job
   * est mort sans rien dire.
   */
  private async terminalizeExhausted(): Promise<number> {
    const { rows } = await this.pool.query<{
      id: string
      content_item_id: string
      content_target_id: string
      unknown_outcome: boolean
    }>(
      `select j.id, j.content_item_id, j.content_target_id,
              (coalesce(j.publish_started_at, ct.publish_started_at) is not null)
                as unknown_outcome
       from public.publish_jobs j
       join public.content_targets ct on ct.id = j.content_target_id
       where j.status in ('claimed', 'publishing')
         and j.lease_expires_at is not null and j.lease_expires_at < now()
         and j.attempts >= j.max_attempts`
    )
    if (rows.length === 0) return 0

    let count = 0
    for (const row of rows) {
      const detail = row.unknown_outcome
        ? "lease expire, tentatives epuisees — une publication a peut-etre eu lieu"
        : "lease expire, tentatives epuisees — aucune publication n a demarre"
      const error = JSON.stringify({ error: "reaper_exhausted", detail })
      await this.withTx(async (c) => {
        // Le `status in (...)` rejoue le filtre : si un autre worker (ou le
        // requeue ci-dessus) est passé entre le SELECT et ici, on ne fait rien.
        const res = await c.query(
          `update public.publish_jobs
           set status = $2::public.publish_job_status, failed_at = now(),
               worker_id = null, claimed_at = null, lease_expires_at = null,
               last_error = $3::jsonb
           where id = $1 and status in ('claimed', 'publishing')`,
          [row.id, row.unknown_outcome ? "needs_verification" : "dead_letter", error]
        )
        if ((res.rowCount ?? 0) === 0) return
        await c.query(
          `update public.content_targets
           set status = $2::public.target_status, last_error = $3::jsonb
           where id = $1`,
          [row.content_target_id, row.unknown_outcome ? "needs_verification" : "failed", error]
        )
        await recomputeParent(c, row.content_item_id)
        count++
      })
      log.error("job termine par le reaper (tentatives epuisees)", {
        jobId: row.id,
        contentItemId: row.content_item_id,
        contentTargetId: row.content_target_id,
        outcomeUnknown: row.unknown_outcome,
      })
    }
    return count
  }

  async extendLease(job: PublishJob, leaseMs: number): Promise<boolean> {
    // Prolonger le lease de N'IMPORTE QUEL propriétaire était le défaut le plus
    // insidieux : un worker zombie maintenait en vie le lease d'un job qu'un
    // autre traitait déjà.
    const { rowCount } = await this.pool.query(
      `update public.publish_jobs
       set lease_expires_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1 and worker_id = $3 and status in ${OWNED_STATUSES}`,
      [job.id, leaseMs, job.workerId]
    )
    return (rowCount ?? 0) > 0
  }

  async patchProgress(
    job: PublishJob,
    patch: { step?: JobStep; externalContainerId?: string }
  ): Promise<void> {
    await this.withTx(async (c) => {
      const res = await c.query(
        `update public.publish_jobs
         set step = coalesce($2, step),
             external_container_id = coalesce($3, external_container_id)
         where id = $1 and worker_id = $4 and status in ${OWNED_STATUSES}`,
        [job.id, patch.step ?? null, patch.externalContainerId ?? null, job.workerId]
      )
      assertOwned(res.rowCount, "patchProgress")
      // Le conteneur est aussi persisté sur la CIBLE : si cette ligne de job
      // disparaît avant la publication, le conteneur reste réutilisable et,
      // surtout, interrogeable.
      if (patch.externalContainerId) {
        await c.query(
          `update public.content_targets
           set external_container_id = coalesce(external_container_id, $2)
           where id = $1`,
          [job.contentTargetId, patch.externalContainerId]
        )
      }
    })
  }

  async markPublishStarted(job: PublishJob, containerId: string): Promise<void> {
    // Trace de l'instant exact où la publication devient irréversible côté Ocean :
    // c'est la ligne à chercher en premier quand on soupçonne une double
    // publication (règle 15).
    log.info("publish_started_at pose (regle 15)", {
      ...jobFields(job),
      externalContainerId: containerId,
    })
    // Règle 15 : les DEUX ancres sont posées (idempotentes via coalesce) et
    // committées AVANT l'appel HTTP de publication. Une seule transaction : une
    // ancre de job sans ancre de cible serait exactement le défaut que la
    // migration 023 corrige.
    await this.withTx(async (c) => {
      // LE fence qui compte : c'est la dernière écriture avant l'appel de
      // publication. S'il échoue ici, `publishFresh` lève et n'appelle JAMAIS
      // publisher.publish() — c'est ce qui rend effective une déprogrammation
      // arrivée pendant le lease (P3-9), et ce qui empêche un worker zombie de
      // publier derrière celui qui a repris le job.
      const res = await c.query(
        `update public.publish_jobs
         set publish_started_at = coalesce(publish_started_at, now()),
             external_container_id = coalesce(external_container_id, $2),
             status = 'publishing', step = 'publish'
         where id = $1 and worker_id = $3 and status in ${OWNED_STATUSES}`,
        [job.id, containerId, job.workerId]
      )
      assertOwned(res.rowCount, "markPublishStarted")
      // L'ancre qui compte : elle survit à la ligne de job.
      await c.query(
        `update public.content_targets
         set publish_started_at = coalesce(publish_started_at, now()),
             external_container_id = coalesce(external_container_id, $2)
         where id = $1`,
        [job.contentTargetId, containerId]
      )
      // État honnête du parent pendant l'exécution.
      await c.query(
        `update public.content_items set status = 'publishing'
         where id = $1 and status in ('scheduled', 'approved', 'partially_published')`,
        [job.contentItemId]
      )
    })
  }

  async markAwaitingMedia(job: PublishJob, retryDelayMs: number): Promise<void> {
    const { rowCount } = await this.pool.query(
      `update public.publish_jobs
       set status = 'awaiting_media', step = 'verify',
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1 and worker_id = $3 and status in ${OWNED_STATUSES}`,
      [job.id, retryDelayMs, job.workerId]
    )
    assertOwned(rowCount, "markAwaitingMedia")
  }

  async succeed(job: PublishJob, result: PublishResult): Promise<void> {
    await this.withTx(async (c) => {
      // Fencé comme les autres. Si le lease est perdu ICI, le post est bien en
      // ligne mais nous n'avons plus le droit d'écrire : le propriétaire courant
      // reclaimera, trouvera la cible ancrée (023), interrogera le conteneur et
      // enregistrera le succès. Rien n'est perdu — la convergence est assurée
      // par la règle 15 elle-même.
      const res = await c.query(
        `update public.publish_jobs
         set status = 'succeeded', step = 'verify', succeeded_at = now(),
             external_post_id = $2, permalink = $3, last_error = null
         where id = $1 and worker_id = $4 and status in ${OWNED_STATUSES}`,
        [job.id, result.externalPostId, result.permalink ?? null, job.workerId]
      )
      assertOwned(res.rowCount, "succeed")
      await c.query(
        `update public.content_targets
         set status = $2, external_post_id = $3, permalink = $4,
             published_at = coalesce(published_at, now()), last_error = null
         where id = $1`,
        [job.contentTargetId, result.targetStatus, result.externalPostId, result.permalink ?? null]
      )
      await bumpQuotaUsage(c, job)
      await recomputeParent(c, job.contentItemId)
    })
    log.info("job succeeded", {
      ...jobFields(job),
      targetStatus: result.targetStatus,
      externalPostId: result.externalPostId,
    })
  }

  async retryOrFail(job: PublishJob, error: unknown, retryDelayMs: number): Promise<void> {
    // attempts+1 >= max => échec définitif ; sinon retrying + backoff.
    const terminal = job.attempts + 1 >= job.maxAttempts
    if (terminal) {
      await this.failPermanent(job, error, false)
      return
    }
    log.warn("job retrying", { ...jobFields(job), retryDelayMs, lastError: errorJson(error) })
    const { rowCount } = await this.pool.query(
      `update public.publish_jobs
       set status = 'retrying', attempts = attempts + 1, step = null,
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000),
           last_error = $3::jsonb
       where id = $1 and worker_id = $4 and status in ${OWNED_STATUSES}`,
      [job.id, retryDelayMs, errorJson(error), job.workerId]
    )
    assertOwned(rowCount, "retryOrFail")
  }

  async failPermanent(job: PublishJob, error: unknown, needsReauth: boolean): Promise<void> {
    // RÈGLE 15 — le fait le plus important de cette méthode : l'ancre était-elle
    // posée ? Si oui, un POST est peut-être parti et on n'a PAS pu conclure
    // (token perdu avant l'interrogation, erreur permanente au publish, réseau
    // coupé). Écrire « échec » serait un mensonge qui produit un doublon dès que
    // l'admin reprogramme. On écrit « on ne sait pas » (migration 024).
    const unknown = isOutcomeUnknown(job)
    const jobStatus = unknown ? "needs_verification" : "failed"
    const targetStatus = unknown ? "needs_verification" : "failed"

    await this.withTx(async (c) => {
      const res = await c.query(
        `update public.publish_jobs
         set status = $3::public.publish_job_status, failed_at = now(), last_error = $2::jsonb
         where id = $1 and worker_id = $4 and status in ${OWNED_STATUSES}`,
        [job.id, errorJson(error), jobStatus, job.workerId]
      )
      assertOwned(res.rowCount, "failPermanent")
      await c.query(
        `update public.content_targets
         set status = $3::public.target_status, last_error = $2::jsonb
         where id = $1`,
        [job.contentTargetId, errorJson(error), targetStatus]
      )
      if (needsReauth) {
        // Le compte a perdu son autorisation : marque à reconnecter (règle 14).
        await c.query(
          `update public.platform_connections pc set status = 'needs_reauth', needs_reauth_at = now()
           from public.social_accounts sa
           where sa.id = $1 and sa.platform_connection_id = pc.id`,
          [job.socialAccountId]
        )
      }
      await recomputeParent(c, job.contentItemId)
    })
    // Canal GARANTI de CLAUDE.md §10 (publish-failed) : à ce jour zéro canal sur
    // trois — ni push, ni Realtime, ni Brevo. Le log est le seul filet en
    // attendant la phase 2 ; il doit donc être lisible et complet.
    log.error(unknown ? "job needs_verification (issue INCONNUE)" : "job failed (definitif)", {
      ...jobFields(job),
      needsReauth,
      outcomeUnknown: unknown,
      lastError: errorJson(error),
    })
  }

  /**
   * Abandon par fenêtre de grâce. La cible reste `failed` et non
   * `needs_verification`, et c'est délibéré : depuis P3-1, le moteur n'appelle
   * `deadLetter` que dans deux situations où l'issue est CONNUE — job jamais
   * démarré, ou conteneur interrogé et confirmé `error`/`expired`. Dire « on ne
   * sait pas » quand on sait rendrait le statut inutile à force d'être posé.
   */
  async deadLetter(job: PublishJob, reason: string): Promise<void> {
    await this.withTx(async (c) => {
      const res = await c.query(
        `update public.publish_jobs
         set status = 'dead_letter', failed_at = now(), last_error = $2::jsonb
         where id = $1 and worker_id = $3 and status in ${OWNED_STATUSES}`,
        [job.id, JSON.stringify({ error: "dead_letter", detail: reason }), job.workerId]
      )
      assertOwned(res.rowCount, "deadLetter")
      await c.query(
        `update public.content_targets set status = 'failed', last_error = $2::jsonb where id = $1`,
        [job.contentTargetId, JSON.stringify({ error: "dead_letter", detail: reason })]
      )
      await recomputeParent(c, job.contentItemId)
    })
    log.error("job dead_letter", { ...jobFields(job), reason, runAt: job.runAt.toISOString() })
  }

  async deferForQuota(job: PublishJob, retryDelayMs: number, reason: string): Promise<void> {
    // Report auto (règle 19) : ni échec ni attempt++, on REDATE.
    //
    // `run_at` est décalé en même temps que `next_attempt_at`, et c'est tout
    // l'objet du correctif : la fenêtre de grâce se mesure sur `run_at`
    // (engine.ts). Un report de 6 h sur un `run_at` inchangé revenait à condamner
    // le job — au réveil il avait plus de 2 h de retard, donc `dead_letter`. Le
    // comportement acté (§5, §6) est un report au prochain créneau disponible,
    // pas une publication perdue.
    log.info("job reporte (quota plateforme atteint)", {
      ...jobFields(job),
      retryDelayMs,
      reason,
      previousRunAt: job.runAt.toISOString(),
    })
    const { rowCount } = await this.pool.query(
      `update public.publish_jobs
       set status = 'retrying', step = 'check_quota',
           worker_id = null, claimed_at = null, lease_expires_at = null,
           run_at = now() + make_interval(secs => $2::double precision / 1000),
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000),
           last_error = $4::jsonb
       where id = $1 and worker_id = $3 and status in ${OWNED_STATUSES}`,
      [
        job.id,
        retryDelayMs,
        job.workerId,
        JSON.stringify({ error: "quota_deferred", detail: reason }),
      ]
    )
    assertOwned(rowCount, "deferForQuota")
  }

  /**
   * PUBLISHERS_MODE=dry-run uniquement. Relâche un job réclamé sans rien décider :
   * pas d'état terminal, pas d'attempts++, aucune écriture sur content_targets ni
   * content_items. Le job retourne dans la file, décalé de `deferMs` pour ne pas
   * être re-réclamé à chaque tick.
   *
   * Volontairement HORS de l'interface JobStore : c'est une manœuvre d'exploitation
   * du mode dry-run, pas une transition de la machine à états (engine.ts n'y a
   * donc pas accès et ne peut pas s'en servir par erreur).
   *
   * Note : le statut d'origine (scheduled / retrying / awaiting_media) n'est pas
   * récupérable — le claim l'a déjà écrasé par 'claimed' — le job repart donc en
   * 'scheduled'. `run_at` et `attempts` sont inchangés.
   */
  async releaseForDryRun(jobId: string, deferMs: number): Promise<void> {
    await this.pool.query(
      `update public.publish_jobs
       set status = 'scheduled', step = null,
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1`,
      [jobId, deferMs]
    )
  }

  private async withTx(fn: (c: pg.PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query("begin")
      await fn(client)
      await client.query("commit")
    } catch (err) {
      await client.query("rollback")
      throw err
    } finally {
      client.release()
    }
  }
}

/**
 * Incrémente le compteur de quota LOCAL du compte social (règle 19), dans la
 * même transaction que le succès — un compteur qui peut diverger du fait qu'il
 * compte ne sert à rien.
 *
 * La table `social_account_quota_usage` (014) n'avait JAMAIS eu d'écrivain : ses
 * seuls INSERT du dépôt étaient des fixtures pgTAP, et `getQuotaUsage` affichait
 * donc 0/100 en permanence dans l'UI.
 *
 * La fenêtre est glissante et posée à la PREMIÈRE publication de la période :
 * `window_resets_at` échu (ou absent) remet `used` à 1 et rouvre une fenêtre.
 */
async function bumpQuotaUsage(c: pg.PoolClient, job: PublishJob): Promise<void> {
  const quota = LOCAL_QUOTAS[job.platform]
  if (!quota) return
  await c.query(
    `insert into public.social_account_quota_usage
       (social_account_id, quota_kind, org_id, client_id, platform,
        used, quota_limit, window_seconds, window_resets_at, source, fetched_at)
     values ($1, $2::public.quota_kind, $3, $4, $5::public.platform,
             1, $6, $7, now() + make_interval(secs => $7), 'local', now())
     on conflict (social_account_id, quota_kind) do update
     set used = case
           when public.social_account_quota_usage.window_resets_at is null
             or public.social_account_quota_usage.window_resets_at <= now()
           then 1
           else public.social_account_quota_usage.used + 1
         end,
         window_resets_at = case
           when public.social_account_quota_usage.window_resets_at is null
             or public.social_account_quota_usage.window_resets_at <= now()
           then now() + make_interval(secs => $7)
           else public.social_account_quota_usage.window_resets_at
         end,
         quota_limit = $6,
         window_seconds = $7,
         source = 'local',
         fetched_at = now()`,
    [
      job.socialAccountId,
      quota.kind,
      job.orgId,
      job.clientId,
      job.platform,
      quota.limit,
      quota.windowSeconds,
    ]
  )
}

/**
 * Recalcule le statut agrégé du content_item d'après ses cibles (manuel + API).
 *
 * L'issue INCONNUE domine (migration 024) : une seule cible en
 * `needs_verification` suffit. Annoncer « publié » sur un contenu dont une
 * plateforme est incertaine serait exactement le mensonge que ce statut existe
 * pour supprimer — et laisser le contenu figé en `publishing` (le comportement
 * d'avant, `needs_verification` n'étant ni `done` ni `bad`) l'enfermait dans un
 * statut d'où la matrice 016 n'autorise aucune sortie.
 */
async function recomputeParent(c: pg.PoolClient, contentItemId: string): Promise<void> {
  await c.query(
    `update public.content_items ci
     set status = case
       when a.unknown > 0 then 'needs_verification'
       when a.total > 0 and a.done = a.total then 'published'
       when a.done > 0 and (a.done + a.bad) = a.total then 'partially_published'
       when a.total > 0 and a.done = 0 and a.bad = a.total then 'failed'
       else ci.status
     end
     from (
       select count(*) total,
              count(*) filter (where status in ('published', 'pushed_to_platform')) done,
              count(*) filter (where status in ('failed', 'skipped', 'canceled')) bad,
              count(*) filter (where status = 'needs_verification') unknown
       from public.content_targets where content_item_id = $1
     ) a
     where ci.id = $1`,
    [contentItemId]
  )
}
