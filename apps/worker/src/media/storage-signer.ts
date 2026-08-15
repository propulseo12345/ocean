import type { FetchLike } from "../http"
import { truncateBody } from "../http"
import { PermanentPublishError } from "../domain"

// Signature d'URL Storage — l'unique endroit du worker qui parle à l'API
// Storage de Supabase.
//
// POURQUOI UNE URL ET PAS DES OCTETS
// -----------------------------------
// Instagram et Facebook ne reçoivent jamais le fichier : ils reçoivent une URL
// qu'ils vont chercher eux-mêmes. Le bucket `media-originals` est PRIVÉ
// (règle 20), donc cette URL est signée à la publication, par le worker, avec
// la clé service_role — et elle ne quitte jamais le worker autrement qu'en
// direction de la plateforme.
//
// ⚠ UNE URL SIGNÉE EST UN SECRET. Elle porte un JWT qui donne accès au fichier
// d'un client pendant 48 h. Elle ne doit JAMAIS être journalisée, ni recopiée
// dans un message d'erreur (règle 12, même esprit que les tokens OAuth). Les
// erreurs de ce module citent le CHEMIN, jamais l'URL.

/** Bucket privé des originaux (règle 20). */
export const ORIGINALS_BUCKET = "media-originals"

/**
 * TTL de l'URL signée : 48 h, et c'est LONG EXPRÈS.
 *
 * Un job qui part en retry épuise jusqu'à 5 tentatives avec backoff
 * exponentiel ; s'y ajoutent la fenêtre de grâce de 2 h et, pour un Reel, le
 * temps que Meta télécharge et transcode la vidéo — Meta va chercher le fichier
 * QUAND IL VEUT, pas quand on poste. Une URL de 15 minutes expirerait entre la
 * création du conteneur et son traitement, et produirait un échec « média
 * invalide » incompréhensible, classé permanent (règle 18), sur un fichier
 * parfaitement valide.
 *
 * NE PAS RACCOURCIR sans avoir relu ce paragraphe.
 */
export const SIGNED_URL_TTL_SECONDS = 48 * 60 * 60

/**
 * Signature échouée pour une raison TRANSITOIRE (Storage indisponible, 5xx,
 * réseau). Ce n'est pas une erreur permanente : le fichier est là, c'est le
 * service qui ne répond pas. Le moteur retentera (backoff), il ne posera pas
 * `failed`.
 */
export class StorageSignError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StorageSignError"
  }
}

export interface StorageSigner {
  /**
   * Signe N chemins du bucket privé, dans l'ORDRE DONNÉ. L'ordre est le
   * contrat : c'est celui du carrousel (content_media.position).
   */
  sign(paths: string[], expiresInSeconds: number): Promise<string[]>
}

interface SignResponseEntry {
  error: string | null
  path: string
  signedURL: string
}

/**
 * Signataire réel (API Storage). `fetch` est injecté : c'est ce qui rend les
 * tests possibles sans projet Supabase.
 */
export function createStorageSigner(opts: {
  supabaseUrl: string
  serviceRoleKey: string
  fetch: FetchLike
  bucket?: string
  signal?: AbortSignal
}): StorageSigner {
  const base = opts.supabaseUrl.replace(/\/+$/, "")
  const bucket = opts.bucket ?? ORIGINALS_BUCKET

  return {
    async sign(paths, expiresInSeconds) {
      if (paths.length === 0) return []

      let res: Response
      try {
        res = await opts.fetch(`${base}/storage/v1/object/sign/${bucket}`, {
          method: "POST",
          headers: {
            apikey: opts.serviceRoleKey,
            authorization: `Bearer ${opts.serviceRoleKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ expiresIn: expiresInSeconds, paths }),
          signal: opts.signal,
        })
      } catch (err) {
        // Réseau coupé, DNS, abort : transitoire par nature.
        throw new StorageSignError(
          `signature Storage injoignable: ${err instanceof Error ? err.name : "inconnu"}`
        )
      }

      if (!res.ok) {
        const body = truncateBody(await safeText(res))
        // 4xx compris : une clé service_role refusée est une panne de
        // configuration, pas un média invalide. On retente — et les 5 échecs
        // laisseront une trace lisible plutôt qu'un `failed` définitif sur le
        // contenu d'un client.
        throw new StorageSignError(`signature Storage HTTP ${res.status}: ${body}`)
      }

      const payload = (await res.json()) as SignResponseEntry[] | unknown
      if (!Array.isArray(payload)) {
        throw new StorageSignError("signature Storage: reponse inattendue (tableau attendu)")
      }
      if (payload.length !== paths.length) {
        throw new StorageSignError(
          `signature Storage: ${payload.length} reponses pour ${paths.length} chemins`
        )
      }

      // L'API renvoie les entrées dans l'ordre des chemins demandés. On ne s'en
      // remet pas à cette promesse : on RÉSOUT par chemin. Une inversion
      // silencieuse publierait les slides d'un carrousel dans le désordre chez
      // un vrai client, et rien ne le signalerait.
      const byPath = new Map<string, SignResponseEntry>()
      for (const entry of payload as SignResponseEntry[]) {
        byPath.set(normalizePath(entry.path), entry)
      }

      return paths.map((path) => {
        const entry = byPath.get(normalizePath(path))
        if (!entry) {
          throw new StorageSignError(`signature Storage: aucune reponse pour ${path}`)
        }
        if (entry.error) {
          // Erreur PAR CHEMIN : l'objet n'existe pas, ou le chemin est refusé.
          // Retenter ne le fera pas apparaître — c'est un média invalide au
          // sens de la règle 18, donc `failed` direct sans retry.
          throw new PermanentPublishError(
            `media introuvable dans ${bucket} (${path}): ${entry.error}`
          )
        }
        if (!entry.signedURL) {
          throw new StorageSignError(`signature Storage: URL vide pour ${path}`)
        }
        return absolute(base, entry.signedURL)
      })
    },
  }
}

/** L'API renvoie tantôt `path`, tantôt `/path` selon les versions. */
function normalizePath(path: string): string {
  return path.replace(/^\/+/, "")
}

/** `signedURL` est relatif à `/storage/v1` (« /object/sign/bucket/… ?token=… »). */
function absolute(base: string, signedUrl: string): string {
  if (/^https?:\/\//i.test(signedUrl)) return signedUrl
  return `${base}/storage/v1/${signedUrl.replace(/^\/+/, "")}`
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return "(corps illisible)"
  }
}
