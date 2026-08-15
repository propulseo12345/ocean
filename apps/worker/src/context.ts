import type pg from "pg"
import { loadPublishTarget } from "./db/publish-target"
import { loadAccessToken } from "./db/secrets"
import { NeedsReauthError, type PublishJob } from "./domain"
import type { StorageSigner } from "./media/storage-signer"
import { resolveJobMedia } from "./media/signed-urls"
import type { PublishContext } from "./publishers/types"
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
