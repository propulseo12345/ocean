import type pg from "pg"
import { loadAccessToken } from "./db/secrets"
import { NeedsReauthError, type PublishJob } from "./domain"
import type { PublishContext } from "./publishers/types"

// Fabrique le contexte de publication d'un job : token frais + (à terme) URL
// signée du média. En mode STUB (publishers de simulation), un token manquant
// n'est PAS bloquant — la simulation ne l'utilise pas. En mode réel, l'absence de
// token = NeedsReauth (le compte doit être reconnecté avant publication).

export function createContextProvider(pool: pg.Pool, opts: { stub: boolean }) {
  return async function prepare(job: PublishJob): Promise<PublishContext> {
    const token = await loadAccessToken(pool, job)
    if (!token) {
      if (opts.stub) return { accessToken: "stub-no-token" }
      throw new NeedsReauthError("aucun token d'accès pour le compte")
    }
    // TODO (mode réel) : rafraîchir le token si proche de l'expiration
    // (tokens/refresh.ts, advisory lock par compte) + générer l'URL signée 48h
    // du média original (media/signed-urls). En stub, inutile.
    return { accessToken: token }
  }
}

/** Vérif quota AVANT publication (règle 19). Stub : toujours OK. */
export function createQuotaChecker(_pool: pg.Pool, opts: { stub: boolean }) {
  return async function checkQuota(_job: PublishJob): Promise<boolean> {
    if (opts.stub) return true
    // TODO (mode réel) : IG GET /content_publishing_limit ; FB header BUC ;
    // TikTok compteur local (social_account_quota_usage). false => report auto.
    return true
  }
}
