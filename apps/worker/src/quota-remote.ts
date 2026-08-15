import type pg from "pg"
import type { PublishJob } from "./domain"
import type { FetchLike } from "./http"
import type { PublishContext } from "./publishers/types"
import { graphCall } from "./publishers/meta/graph"
import type { QuotaKind } from "./quota"

// La moitié DISTANTE de la règle 19 : ce que la PLATEFORME dit de la charge du
// compte, par opposition à ce qu'Ocean a compté.
//
// POURQUOI LES DEUX MOITIÉS SONT NÉCESSAIRES
// -------------------------------------------
// Le compteur local ignore tout ce qui a été publié EN DEHORS d'Ocean — depuis
// l'app Instagram, depuis Meta Business Suite, depuis un autre outil. Un
// freelance qui poste à la main dans la journée peut donc être à 100/100 chez
// Meta pendant qu'Ocean affiche 12/100, et le job de 18 h échoue sans que
// personne comprenne. Inversement, le distant seul ne suffit pas : entre deux
// appels, c'est le compteur local qui tient la fenêtre.
//
// ET LES DEUX PLATEFORMES NE RÉPONDENT PAS AU MÊME MOMENT — c'est le point
// contre-intuitif de ce module :
//   Instagram : sonde AVANT le post (GET /content_publishing_limit) ;
//   Facebook  : en-tête X-Business-Use-Case-Usage renvoyé par CHAQUE appel,
//               donc relevé EN SORTIE. Il n'existe aucune sonde « avant » côté
//               FB, et l'inventer reviendrait à faire un appel de plus pour
//               obtenir la même information qu'on recevra de toute façon.

export interface RemoteQuotaSnapshot {
  kind: QuotaKind
  /** Consommation observée chez la plateforme sur la fenêtre. */
  used: number
  /** Plafond annoncé par la plateforme, `null` s'il ne l'annonce pas. */
  limit: number | null
  windowSeconds: number
  /** Réponse brute, conservée dans `raw` pour le diagnostic (aucun secret). */
  raw: unknown
}

export type RemoteQuotaProbe = (
  job: PublishJob,
  ctx: PublishContext
) => Promise<RemoteQuotaSnapshot | null>

interface PublishingLimitResponse {
  data?: { quota_usage?: number; config?: { quota_total?: number; quota_duration?: number } }[]
}

/**
 * Instagram — `GET /{ig-user-id}/content_publishing_limit`, AVANT chaque post
 * (règle 19).
 *
 * Un échec de la sonde ne doit JAMAIS empêcher de publier : ce serait
 * transformer une vérification en point de panne. On rend `null`, la décision
 * retombe sur le compteur local, et l'appelant journalise.
 */
export function createInstagramQuotaProbe(fetchImpl: FetchLike, base?: string): RemoteQuotaProbe {
  return async (_job, ctx) => {
    const { data } = await graphCall<PublishingLimitResponse>(
      fetchImpl,
      {
        method: "GET",
        path: `${ctx.providerAccountId}/content_publishing_limit`,
        params: { fields: "config,quota_usage" },
        accessToken: ctx.accessToken,
        signal: ctx.signal,
      },
      base
    )
    const row = data.data?.[0]
    if (!row || typeof row.quota_usage !== "number") return null
    return {
      kind: "ig_publish",
      used: row.quota_usage,
      limit: row.config?.quota_total ?? null,
      windowSeconds: row.config?.quota_duration ?? 86_400,
      raw: row,
    }
  }
}

/**
 * Facebook — l'en-tête `X-Business-Use-Case-Usage`.
 *
 * ⚠ `call_count` est un POURCENTAGE du budget consommé, pas un nombre d'appels.
 * Le lire comme un compte d'appels afficherait « 28/4800 » là où Meta dit
 * « 28 % consommés », c'est-à-dire une jauge fausse d'un facteur ~170 — et une
 * jauge fausse dans ce sens-là ne protège de rien.
 */
export function parseBucHeader(header: string | null, pageId: string): RemoteQuotaSnapshot | null {
  if (!header) return null
  let parsed: Record<string, { call_count?: number; estimated_time_to_regain_access?: number }[]>
  try {
    parsed = JSON.parse(header)
  } catch {
    return null
  }
  const entry = parsed[pageId]?.[0]
  if (!entry || typeof entry.call_count !== "number") return null
  return {
    kind: "fb_buc",
    used: entry.call_count,
    limit: 100,
    windowSeconds: 86_400,
    raw: entry,
  }
}

/**
 * Persiste la vérité de la plateforme avec `source = 'api'`.
 *
 * `source` existe déjà dans le schéma : `social_account_quota_usage.source text
 * not null default 'api'` avec `check (source in ('api','local'))` (014:112 et
 * 014:123). AUCUNE migration n'est nécessaire — la vérification a été faite
 * avant d'écrire une ligne de SQL.
 *
 * L'UPSERT écrase délibérément la valeur locale : quand la plateforme parle,
 * elle a raison. `bumpQuotaUsage` (pg-store) repassera ensuite en `local` à
 * chaque succès, ce qui est exactement le comportement voulu — le local
 * incrémente entre deux relevés distants.
 */
export async function saveRemoteQuota(
  pool: pg.Pool,
  job: PublishJob,
  snap: RemoteQuotaSnapshot
): Promise<void> {
  await pool.query(
    `insert into public.social_account_quota_usage
       (social_account_id, quota_kind, org_id, client_id, platform,
        used, quota_limit, window_seconds, window_resets_at, source, raw, fetched_at)
     values ($1, $2::public.quota_kind, $3, $4, $5::public.platform,
             $6, $7, $8, now() + make_interval(secs => $8), 'api', $9::jsonb, now())
     on conflict (social_account_id, quota_kind) do update
     set used = excluded.used,
         quota_limit = coalesce(excluded.quota_limit, public.social_account_quota_usage.quota_limit),
         window_seconds = excluded.window_seconds,
         -- La fenêtre glissante de la plateforme n'est pas rouverte par notre
         -- relevé : on ne la repousse que si l'ancienne est échue ou absente.
         -- L'écraser à chaque appel repousserait indéfiniment la réouverture et
         -- gèlerait un compte au plafond.
         window_resets_at = case
           when public.social_account_quota_usage.window_resets_at is null
             or public.social_account_quota_usage.window_resets_at <= now()
           then excluded.window_resets_at
           else public.social_account_quota_usage.window_resets_at
         end,
         source = 'api',
         raw = excluded.raw,
         fetched_at = now()`,
    [
      job.socialAccountId,
      snap.kind,
      job.orgId,
      job.clientId,
      job.platform,
      snap.used,
      snap.limit,
      snap.windowSeconds,
      JSON.stringify(snap.raw ?? {}),
    ]
  )
}
