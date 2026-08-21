import { NeedsReauthError, PermanentPublishError } from "../../domain"
import { type FetchLike, redactSecrets, truncateBody } from "../../http"

// Client Graph API partagé par Instagram et Facebook — appels, et surtout
// CLASSIFICATION DES ERREURS.
//
// POURQUOI LA CLASSIFICATION EST LE CŒUR DE CE FICHIER
// -----------------------------------------------------
// La règle 18 impose de distinguer deux familles, et se tromper coûte dans les
// deux sens :
//   - retenter une erreur PERMANENTE (token révoqué, média rejeté) épuise cinq
//     tentatives pour rien et retarde le diagnostic de plusieurs heures ;
//   - déclarer PERMANENTE une erreur transitoire (rate limit, 500 Meta) pose
//     `failed` sur un contenu que rien n'empêchait de publier, chez un vrai
//     client, sans deuxième chance automatique.
// Un code 190 ne se retente jamais ; un code 4 si. C'est une table, pas une
// intuition — et elle est testée.

export const GRAPH_VERSION = "v21.0"
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

/** En-tête de charge Meta, lu EN SORTIE d'appel (voir quota, règle 19). */
export const BUC_HEADER = "x-business-use-case-usage"

export interface MetaErrorBody {
  message?: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

/** Réponse Graph : le corps ET les en-têtes (le quota FB vit dans un en-tête). */
export interface GraphResponse<T> {
  data: T
  headers: Headers
}

/**
 * Codes d'erreur qui exigent une RECONNEXION humaine (règle 14).
 * 190 = token invalide/expiré/révoqué ; 102 = session invalide ;
 * 458/459/460/463/464/467 sont ses sous-codes usuels.
 */
const REAUTH_CODES = new Set([102, 190])

/**
 * Codes PERMANENTS hors reconnexion : la requête ne peut pas aboutir, telle
 * quelle, jamais. Permissions manquantes, contenu refusé, média invalide.
 */
const PERMANENT_CODES = new Set([
  3, // capacité d'API non disponible pour cette app
  10, // permission refusée (scope non accordé)
  100, // paramètre invalide — y compris une URL de média que Meta refuse
  200, // permission manquante sur la Page
  294, // droit d'administration manquant
  324, // média manquant ou trop volumineux
  // 368 « temporairement bloqué pour violation des règles » est classé
  // PERMANENT à dessein, malgré son libellé : c'est le fait de réessayer qui
  // provoque et aggrave ce blocage. Un humain doit regarder.
  368,
  9004, // IG : le média n'a pas pu être récupéré / est invalide
  36000, // IG : format de média non pris en charge
  36001,
  36003,
])

/**
 * Codes TRANSITOIRES : la même requête a de bonnes chances d'aboutir plus tard.
 * Rate limits (4, 17, 32, 613, 80001-80007) et pannes Meta (1, 2, 341).
 */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613])

/** Sous-codes IG d'upload : la plupart sont définitifs, deux ne le sont pas. */
const TRANSIENT_IG_UPLOAD = new Set([
  2207003, // Meta n'a pas réussi à télécharger le média — souvent son réseau
  2207052, // erreur inconnue côté transcodage
  2207053,
])

export class MetaApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly fbtraceId: string | null,
    message: string
  ) {
    super(message)
    this.name = "MetaApiError"
  }
}

/**
 * Traduit une erreur Meta en erreur Ocean, donc en DÉCISION du moteur.
 *
 * L'ordre des tests est le fond du sujet :
 *   1. reconnexion (le compte est perdu, rien d'autre n'a d'importance) ;
 *   2. rate limits et pannes — explicitement transitoires ;
 *   3. permanents connus ;
 *   4. par défaut : TRANSITOIRE. Un code inconnu ne doit pas condamner le
 *      contenu d'un client sur une supposition. Cinq tentatives puis `failed`
 *      laissent une trace ; un `failed` immédiat sur un code qu'on n'a pas su
 *      lire est une décision qu'on n'a pas les moyens de prendre.
 */
export function toPublishError(err: MetaApiError): Error {
  const { code, subcode } = err
  if (code !== null && REAUTH_CODES.has(code)) {
    return new NeedsReauthError(`meta ${code}/${subcode ?? "-"}: ${err.message}`)
  }
  if (code !== null && TRANSIENT_CODES.has(code)) return err
  if (subcode !== null && TRANSIENT_IG_UPLOAD.has(subcode)) return err
  // Les sous-codes IG d'upload 2207xxx non listés comme transitoires sont des
  // rejets de média : format, durée, ratio. Retenter est inutile.
  if (subcode !== null && subcode >= 2207000 && subcode < 2208000) {
    return new PermanentPublishError(`meta ${code ?? "-"}/${subcode}: ${err.message}`)
  }
  if (code !== null && PERMANENT_CODES.has(code)) {
    return new PermanentPublishError(`meta ${code}/${subcode ?? "-"}: ${err.message}`)
  }
  // 429 et 5xx sans code exploitable : transitoires par nature.
  return err
}

export interface GraphRequest {
  method: "GET" | "POST"
  /** Chemin SANS la version ni le slash initial : « 17841400000/media ». */
  path: string
  /** Paramètres de requête (GET) ou de formulaire (POST). */
  params?: Record<string, string | undefined>
  accessToken: string
  signal?: AbortSignal
}

/**
 * Un appel Graph. `fetch` est injecté — aucun publisher n'appelle le `fetch`
 * global, c'est ce qui rend le dialogue vérifiable sans app Meta.
 *
 * Le token part en EN-TÊTE `Authorization`, jamais en paramètre d'URL : Meta
 * recopie volontiers l'URL appelée dans ses messages d'erreur, et cette chaîne
 * finit dans `publish_jobs.last_error`, que l'app affiche (règle 12). Ce qui
 * échappe malgré tout passe par `redactSecrets`.
 */
export async function graphRequest<T>(
  fetchImpl: FetchLike,
  req: GraphRequest,
  base: string = GRAPH_BASE
): Promise<GraphResponse<T>> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(req.params ?? {})) {
    if (v !== undefined) params.set(k, v)
  }

  const url =
    req.method === "GET" && params.size > 0
      ? `${base}/${req.path}?${params.toString()}`
      : `${base}/${req.path}`

  const res = await fetchImpl(url, {
    method: req.method,
    headers: {
      authorization: `Bearer ${req.accessToken}`,
      ...(req.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: req.method === "POST" ? params.toString() : undefined,
    signal: req.signal,
  })

  const raw = await safeText(res)
  const clean = truncateBody(redactSecrets(raw, [req.accessToken]))

  if (!res.ok) {
    const parsed = parseError(raw)
    throw new MetaApiError(
      res.status,
      parsed?.code ?? null,
      parsed?.error_subcode ?? null,
      parsed?.fbtrace_id ?? null,
      `HTTP ${res.status} — ${redactSecrets(parsed?.message ?? clean, [req.accessToken])}`
    )
  }

  let data: T
  try {
    data = JSON.parse(raw) as T
  } catch {
    throw new MetaApiError(res.status, null, null, null, `reponse Graph illisible: ${clean}`)
  }

  // Meta répond parfois 200 avec un objet d'erreur. Sans ce test, un échec
  // serait lu comme un succès et l'`id` manquant produirait un `undefined`
  // écrit en base comme identifiant de publication.
  const inline = (data as { error?: MetaErrorBody }).error
  if (inline) {
    throw new MetaApiError(
      res.status,
      inline.code ?? null,
      inline.error_subcode ?? null,
      inline.fbtrace_id ?? null,
      `HTTP 200 avec erreur — ${redactSecrets(inline.message ?? "", [req.accessToken])}`
    )
  }
  return { data, headers: res.headers }
}

/** Même chose, mais l'erreur est déjà classée pour le moteur. */
export async function graphCall<T>(
  fetchImpl: FetchLike,
  req: GraphRequest,
  base?: string
): Promise<GraphResponse<T>> {
  try {
    return await graphRequest<T>(fetchImpl, req, base)
  } catch (err) {
    if (err instanceof MetaApiError) throw toPublishError(err)
    throw err
  }
}

function parseError(raw: string): MetaErrorBody | null {
  try {
    return (JSON.parse(raw) as { error?: MetaErrorBody }).error ?? null
  } catch {
    return null
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}
