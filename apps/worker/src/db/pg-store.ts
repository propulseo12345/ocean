import type pg from "pg"
import type { JobStep, PublishJob, PublishResult } from "../domain"
import type { JobStore } from "../store"

// Implémentation Postgres de la file (Supavisor SESSION). L'horloge est now()
// Postgres (règle 17). Les écritures terminales touchent DEUX niveaux dans une
// transaction : le job (technique) ET content_targets (métier) + agrégat parent.

const JOB_COLUMNS = `
  id, org_id, client_id, content_item_id, content_target_id, social_account_id,
  platform, status, step, run_at, attempts, max_attempts, worker_id, claimed_at,
  lease_expires_at, publish_started_at, external_container_id, external_post_id,
  permalink, next_attempt_at, last_error`

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
      select claimed.*, now() as _now from claimed`
    const { rows } = await this.pool.query(sql, [workerId, leaseMs])
    const row = rows[0]
    if (!row) return null
    return { job: rowToJob(row), now: row._now as Date }
  }

  async reapExpired(): Promise<number> {
    // Reaper : un job dont le lease a expiré (worker mort en cours) redevient
    // « retrying » pour re-claim. attempts++ borne les boucles. Les jobs à bout de
    // tentatives sont laissés au watchdog pg_cron (indépendant, §5) qui notifie.
    const sql = `
      update public.publish_jobs
      set status = 'retrying', attempts = attempts + 1,
          worker_id = null, claimed_at = null, lease_expires_at = null,
          next_attempt_at = now()
      where status in ('claimed', 'publishing')
        and lease_expires_at is not null and lease_expires_at < now()
        and attempts < max_attempts`
    const { rowCount } = await this.pool.query(sql)
    return rowCount ?? 0
  }

  async extendLease(jobId: string, leaseMs: number): Promise<void> {
    await this.pool.query(
      `update public.publish_jobs
       set lease_expires_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1`,
      [jobId, leaseMs]
    )
  }

  async patchProgress(
    jobId: string,
    patch: { step?: JobStep; externalContainerId?: string }
  ): Promise<void> {
    await this.pool.query(
      `update public.publish_jobs
       set step = coalesce($2, step),
           external_container_id = coalesce($3, external_container_id)
       where id = $1`,
      [jobId, patch.step ?? null, patch.externalContainerId ?? null]
    )
  }

  async markPublishStarted(job: PublishJob): Promise<void> {
    // Règle 15 : publish_started_at posé (idempotent via coalesce) AVANT publish.
    // Chaque requête hors transaction explicite est auto-commitée => la marque est
    // durable avant l'appel HTTP de publication.
    await this.pool.query(
      `update public.publish_jobs
       set publish_started_at = coalesce(publish_started_at, now()),
           status = 'publishing', step = 'publish'
       where id = $1`,
      [job.id]
    )
    // État honnête du parent pendant l'exécution.
    await this.pool.query(
      `update public.content_items set status = 'publishing'
       where id = $1 and status in ('scheduled', 'approved', 'partially_published')`,
      [job.contentItemId]
    )
  }

  async markAwaitingMedia(jobId: string, retryDelayMs: number): Promise<void> {
    await this.pool.query(
      `update public.publish_jobs
       set status = 'awaiting_media', step = 'verify',
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1`,
      [jobId, retryDelayMs]
    )
  }

  async succeed(job: PublishJob, result: PublishResult): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `update public.publish_jobs
         set status = 'succeeded', step = 'verify', succeeded_at = now(),
             external_post_id = $2, permalink = $3, last_error = null
         where id = $1`,
        [job.id, result.externalPostId, result.permalink ?? null]
      )
      await c.query(
        `update public.content_targets
         set status = $2, external_post_id = $3, permalink = $4,
             published_at = coalesce(published_at, now()), last_error = null
         where id = $1`,
        [job.contentTargetId, result.targetStatus, result.externalPostId, result.permalink ?? null]
      )
      await recomputeParent(c, job.contentItemId)
    })
  }

  async retryOrFail(job: PublishJob, error: unknown, retryDelayMs: number): Promise<void> {
    // attempts+1 >= max => échec définitif ; sinon retrying + backoff.
    const terminal = job.attempts + 1 >= job.maxAttempts
    if (terminal) {
      await this.failPermanent(job, error, false)
      return
    }
    await this.pool.query(
      `update public.publish_jobs
       set status = 'retrying', attempts = attempts + 1, step = null,
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000),
           last_error = $3::jsonb
       where id = $1`,
      [job.id, retryDelayMs, errorJson(error)]
    )
  }

  async failPermanent(job: PublishJob, error: unknown, needsReauth: boolean): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `update public.publish_jobs
         set status = 'failed', failed_at = now(), last_error = $2::jsonb
         where id = $1`,
        [job.id, errorJson(error)]
      )
      await c.query(
        `update public.content_targets set status = 'failed', last_error = $2::jsonb where id = $1`,
        [job.contentTargetId, errorJson(error)]
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
  }

  async deadLetter(job: PublishJob, reason: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `update public.publish_jobs
         set status = 'dead_letter', failed_at = now(), last_error = $2::jsonb
         where id = $1`,
        [job.id, JSON.stringify({ error: "dead_letter", detail: reason })]
      )
      await c.query(
        `update public.content_targets set status = 'failed', last_error = $2::jsonb where id = $1`,
        [job.contentTargetId, JSON.stringify({ error: "dead_letter", detail: reason })]
      )
      await recomputeParent(c, job.contentItemId)
    })
  }

  async deferForQuota(job: PublishJob, retryDelayMs: number): Promise<void> {
    // Report auto (règle 19) : ni échec ni attempt++, on repousse simplement.
    await this.pool.query(
      `update public.publish_jobs
       set status = 'retrying', step = 'check_quota',
           worker_id = null, claimed_at = null, lease_expires_at = null,
           next_attempt_at = now() + make_interval(secs => $2::double precision / 1000)
       where id = $1`,
      [job.id, retryDelayMs]
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

/** Recalcule le statut agrégé du content_item d'après ses cibles (manuel + API). */
async function recomputeParent(c: pg.PoolClient, contentItemId: string): Promise<void> {
  await c.query(
    `update public.content_items ci
     set status = case
       when a.total > 0 and a.done = a.total then 'published'
       when a.done > 0 and (a.done + a.bad) = a.total then 'partially_published'
       when a.total > 0 and a.done = 0 and a.bad = a.total then 'failed'
       else ci.status
     end
     from (
       select count(*) total,
              count(*) filter (where status in ('published', 'pushed_to_platform')) done,
              count(*) filter (where status in ('failed', 'skipped', 'canceled')) bad
       from public.content_targets where content_item_id = $1
     ) a
     where ci.id = $1`,
    [contentItemId]
  )
}
