import type pg from "pg"
import type { PublishJob } from "./domain"
import { log } from "./log"
import type { PublishContext } from "./publishers/types"
import { decideQuota, type LocalQuota, LOCAL_QUOTAS, type QuotaVerdict } from "./quota"
import { type RemoteQuotaProbe, saveRemoteQuota } from "./quota-remote"

// Vérif quota AVANT publication (règle 19) — les deux moitiés réunies.
//
//   DISTANT (quota-remote.ts) : la vérité de la plateforme. Interrogée EN
//   PREMIER, et son résultat est écrit avec `source = 'api'` — c'est ce qui
//   rend la jauge de l'UI exacte au lieu d'optimiste.
//
//   LOCAL (quota.ts) : ce qu'Ocean a publié. Il tient la fenêtre entre deux
//   relevés distants et protège du cas réel le plus probable, un backlog
//   rattrapé qui enchaîne 120 posts en une nuit.
//
// La décision finale se prend TOUJOURS sur la ligne en base, jamais sur la
// réponse distante directement : les deux sources y sont déjà fusionnées, et
// une seule règle de fenêtre (decideQuota) évite d'en avoir deux qui divergent.

/**
 * Facebook n'a pas de quota local calculable (le BUC dépend de l'engagement de
 * la Page), mais il a un quota DISTANT : `call_count` est un pourcentage du
 * budget consommé. 100 % = plafond atteint. C'est le seul plafond honnête
 * disponible côté FB, et il ne devient lisible qu'après un premier appel.
 */
const FB_BUC_QUOTA: LocalQuota = { kind: "fb_buc", limit: 100, windowSeconds: 86_400 }

export interface QuotaCheckDeps {
  stub: boolean
  /** Sonde distante par plateforme. Absente = on s'en remet au local. */
  probes?: Partial<Record<PublishJob["platform"], RemoteQuotaProbe>>
}

export function createQuotaChecker(pool: pg.Pool, opts: QuotaCheckDeps) {
  return async function checkQuota(job: PublishJob, ctx: PublishContext): Promise<QuotaVerdict> {
    // Le stub ne publie rien, donc ne consomme rien.
    if (opts.stub) return { ok: true }

    // 1. DISTANT d'abord. Un échec de la sonde ne bloque JAMAIS la
    //    publication : transformer une vérification en point de panne rendrait
    //    la précaution plus dangereuse que son absence.
    const probe = opts.probes?.[job.platform]
    if (probe) {
      try {
        const snap = await probe(job, ctx)
        if (snap) await saveRemoteQuota(pool, job, snap)
      } catch (err) {
        log.warn("sonde de quota distante indisponible : on s en remet au compteur local", {
          jobId: job.id,
          platform: job.platform,
          error: err instanceof Error ? err.name : "inconnu",
        })
      }
    }

    // 2. LOCAL. Facebook n'a pas de quota local, mais il a une ligne `fb_buc`
    //    alimentée par l'en-tête de la réponse PRÉCÉDENTE (règle 19, LOT 3).
    const quota = LOCAL_QUOTAS[job.platform] ?? (job.platform === "facebook" ? FB_BUC_QUOTA : null)
    if (!quota) {
      log.warn("aucun quota enforcable pour cette plateforme", {
        jobId: job.id,
        platform: job.platform,
      })
      return { ok: true }
    }

    const { rows } = await pool.query<{ used: number; window_resets_at: Date | null }>(
      `select used, window_resets_at
       from public.social_account_quota_usage
       where social_account_id = $1 and quota_kind = $2::public.quota_kind`,
      [job.socialAccountId, quota.kind]
    )
    const row = rows[0] ? { used: rows[0].used, windowResetsAt: rows[0].window_resets_at } : null

    // L'horloge de référence est celle de Postgres (règle 17) — jamais
    // Date.now() du process.
    const verdict = decideQuota(quota, row, await postgresNow(pool))
    if (!verdict.ok) {
      // Quota atteint => REPORT automatique, pas échec (§5). `deferForQuota`
      // redate `run_at`, sinon la fenêtre de grâce condamnerait le job.
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
