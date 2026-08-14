import type pg from "pg"
import { loadAccessToken } from "./db/secrets"
import { NeedsReauthError, type PublishJob } from "./domain"
import { log } from "./log"
import type { PublishContext } from "./publishers/types"
import { decideQuota, LOCAL_QUOTAS, type QuotaVerdict } from "./quota"

// Fabrique le contexte de publication d'un job : token frais + (à terme) URL
// signée du média. `stub` est vrai UNIQUEMENT quand PUBLISHERS_MODE=stub (env.ts,
// autorisé sur base locale seulement) : un token manquant n'est alors pas
// bloquant, la simulation ne l'utilise pas. En mode live, l'absence de token =
// NeedsReauth (le compte doit être reconnecté avant publication). En dry-run,
// rien de tout ceci n'est appelé : le job n'entre pas dans la machine à états.

export function createContextProvider(pool: pg.Pool, opts: { stub: boolean }) {
  return async function prepare(job: PublishJob): Promise<PublishContext> {
    const token = await loadAccessToken(pool, job)
    if (!token) {
      if (opts.stub) return { accessToken: "stub-no-token" }
      throw new NeedsReauthError("aucun token d'accès pour le compte")
    }
    // TODO (PUBLISHERS_MODE=live) : rafraîchir le token si proche de l'expiration
    // (tokens/refresh.ts, advisory lock par compte) + générer l'URL signée 48h
    // du média original (media/signed-urls). En stub, inutile.
    return { accessToken: token }
  }
}

/**
 * Vérif quota AVANT publication (règle 19).
 *
 * Deux moitiés, dont une seule est ici :
 *
 *   LOCAL (implémenté) — `social_account_quota_usage` compte ce qu'Ocean a
 *   publié par compte social. C'est ce qui protège du cas réel le plus probable :
 *   un backlog rattrapé qui enchaîne 120 posts en une nuit.
 *
 *   DISTANT (phase 6, branché explicitement ci-dessous) — la vérité de la
 *   plateforme : `GET /content_publishing_limit` côté IG, en-tête
 *   `X-Business-Use-Case-Usage` côté FB. Indispensable, parce que le compteur
 *   local ignore tout ce qui a été publié en dehors d'Ocean.
 *
 * Le stub court-circuite tout : il ne publie rien, il ne consomme rien.
 */
export function createQuotaChecker(pool: pg.Pool, opts: { stub: boolean }) {
  return async function checkQuota(job: PublishJob): Promise<QuotaVerdict> {
    if (opts.stub) return { ok: true }

    const quota = LOCAL_QUOTAS[job.platform]
    if (!quota) {
      // Facebook : le BUC dépend de l'engagement de la Page, il n'est pas
      // calculable localement. On laisse passer, en le DISANT — un compteur
      // local inventé serait pire qu'une absence assumée.
      log.warn("quota non enforcable localement (a brancher en phase 6)", {
        jobId: job.id,
        platform: job.platform,
      })
      return { ok: true }
    }

    // PHASE 6 — brancher ici l'appel distant AVANT la décision locale, et faire
    // un UPSERT de son résultat dans social_account_quota_usage (source = 'api').
    // Le compteur local reste utile après : il tient la fenêtre entre deux appels.

    const { rows } = await pool.query<{ used: number; window_resets_at: Date | null }>(
      `select used, window_resets_at
       from public.social_account_quota_usage
       where social_account_id = $1 and quota_kind = $2::public.quota_kind`,
      [job.socialAccountId, quota.kind]
    )
    const row = rows[0] ? { used: rows[0].used, windowResetsAt: rows[0].window_resets_at } : null

    // L'horloge de référence est celle du claim (now() Postgres, règle 17) —
    // jamais Date.now() du process.
    const verdict = decideQuota(quota, row, await postgresNow(pool))
    if (!verdict.ok) {
      log.warn("quota plateforme atteint : report", {
        jobId: job.id,
        socialAccountId: job.socialAccountId,
        platform: job.platform,
        quotaKind: quota.kind,
        reason: verdict.reason,
        retryAfterMs: verdict.retryAfterMs,
      })
    }
    return verdict
  }
}

async function postgresNow(pool: pg.Pool): Promise<Date> {
  const { rows } = await pool.query<{ now: Date }>("select now() as now")
  const row = rows[0]
  if (!row) throw new Error("select now() sans resultat")
  return row.now
}
