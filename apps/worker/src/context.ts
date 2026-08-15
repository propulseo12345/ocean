import type pg from "pg"
import { loadPublishTarget } from "./db/publish-target"
import { loadAccessToken } from "./db/secrets"
import { NeedsReauthError, type PublishJob } from "./domain"
import { log } from "./log"
import type { StorageSigner } from "./media/storage-signer"
import { resolveJobMedia } from "./media/signed-urls"
import type { PublishContext } from "./publishers/types"
import { decideQuota, LOCAL_QUOTAS, type QuotaVerdict } from "./quota"
import { refreshConnectionForJob } from "./tokens/job-refresh"

// Fabrique le contexte de publication d'un job : compte cible, token FRAIS,
// légende, et URL signées 48 h des médias.
//
// `stub` est vrai UNIQUEMENT quand PUBLISHERS_MODE=stub (env.ts, base locale
// seulement) : rien n'est lu ni signé, la simulation n'en a pas l'usage. En
// dry-run, ce module n'est jamais appelé — le job n'entre pas dans la machine à
// états.

export interface ContextDeps {
  stub: boolean
  /** Signataire d'URL Storage. `null` en stub. */
  storage: StorageSigner | null
  /**
   * Rafraîchissement du token de la connexion avant publication. `null` =
   * désactivé (stub, ou identifiants de plateforme absents : mieux vaut publier
   * avec le token en base que refuser au motif qu'on ne sait pas le renouveler).
   */
  refresh: ContextRefresh | null
}

export interface ContextRefresh {
  run: (pool: pg.Pool, connectionId: string, provider: string) => Promise<void>
  /**
   * Budget de temps du rafraîchissement, à l'intérieur du chemin de publication.
   *
   * LE PIÈGE QUE CETTE BORNE FERME — le lease d'un job réclamé dure 2 min. Le
   * refresh, lui, contient un appel réseau chez un fournisseur qui peut ne
   * jamais répondre. Sans borne, un Meta pendu tiendrait le job jusqu'à
   * expiration du lease, le reaper le rendrait à la file, et un second worker
   * repartirait sur le même compte — deux échanges concurrents, soit exactement
   * ce que l'advisory lock de la règle 14 existe pour empêcher.
   *
   * Le verrou, lui, N'EST PAS tenu pendant l'appel : refresh.ts découpe en
   * trois phases et l'appel réseau tombe entre deux transactions. Cette borne
   * protège le LEASE, pas le verrou.
   */
  timeoutMs: number
}

/** Timeout du refresh dans le chemin de publication (borne du lease de 2 min). */
export class TokenRefreshTimeoutError extends Error {
  constructor(ms: number) {
    super(`rafraichissement de token sans reponse apres ${ms} ms`)
    this.name = "TokenRefreshTimeoutError"
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TokenRefreshTimeoutError(ms)), ms)
  })
  return Promise.race([work, guard]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

export function createContextProvider(pool: pg.Pool, opts: ContextDeps) {
  return async function prepare(job: PublishJob): Promise<PublishContext> {
    if (opts.stub) {
      const token = await loadAccessToken(pool, job)
      // La simulation n'appelle personne : un token manquant n'est pas
      // bloquant, et rien n'est signé (aucun octet ne partira).
      return {
        accessToken: token ?? "stub-no-token",
        providerAccountId: "stub-account",
        media: [],
        caption: "",
        format: "post",
      }
    }

    const target = await loadPublishTarget(pool, job)

    // 1. Token frais AVANT tout le reste (workflow §7 : « refresh vérifié AVANT,
    //    jamais à l'heure H sans filet »). Un échec de rafraîchissement n'est
    //    PAS fatal en soi : le token en base peut encore être valide, et refuser
    //    de publier parce que le renouvellement a échoué transformerait une
    //    précaution en panne. C'est `refreshConnectionForJob` qui lève
    //    NeedsReauth quand le compte est réellement perdu.
    if (opts.refresh) {
      await withTimeout(
        opts.refresh.run(pool, target.connectionId, target.connectionProvider),
        opts.refresh.timeoutMs
      )
    }

    // 2. Le token à utiliser : celui de la PAGE si elle en a un
    //    (social_account_secrets), sinon celui de la connexion.
    const token = await loadAccessToken(pool, job)
    if (!token) throw new NeedsReauthError("aucun token d'accès pour le compte")

    // 3. Médias signés (TTL 48 h). Appels HTTP hors transaction : `prepare` est
    //    appelé par le moteur en dehors de toute transaction ouverte.
    const media = opts.storage ? await resolveJobMedia(pool, job, opts.storage) : []

    return {
      accessToken: token,
      providerAccountId: target.providerAccountId,
      media,
      caption: target.caption,
      format: target.format,
      firstComment: target.firstComment,
    }
  }
}

/** Rafraîchissement réel branché sur la base (défaut de production). */
export const REAL_REFRESH: ContextRefresh["run"] = refreshConnectionForJob

/**
 * Vérif quota AVANT publication (règle 19).
 *
 * Deux moitiés, dont une seule est ici :
 *
 *   LOCAL (implémenté) — `social_account_quota_usage` compte ce qu'Ocean a
 *   publié par compte social. C'est ce qui protège du cas réel le plus probable :
 *   un backlog rattrapé qui enchaîne 120 posts en une nuit.
 *
 *   DISTANT (LOT 4) — la vérité de la plateforme : `GET /content_publishing_limit`
 *   côté IG, en-tête `X-Business-Use-Case-Usage` côté FB.
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

    // LOT 4 — brancher ici l'appel distant AVANT la décision locale, et faire un
    // UPSERT de son résultat dans social_account_quota_usage (source = 'api').

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
