import { PermanentPublishError, type PublishJob } from "../domain"
import type { Queryable } from "../db/queryable"
import { SIGNED_URL_TTL_SECONDS, type StorageSigner } from "./storage-signer"

// Résolution du média d'un job : lire les liaisons `content_media` du contenu,
// dans l'ordre du carrousel, puis signer chaque original (TTL 48 h, règle 20).
//
// UN JOB MULTI-MÉDIAS SIGNE CHAQUE MÉDIA, DANS L'ORDRE DE content_media.position
// ------------------------------------------------------------------------------
// L'ordre n'est pas un détail d'affichage : la position 0 est la couverture du
// carrousel (012:80). Le signataire résout d'ailleurs ses réponses PAR CHEMIN
// pour ne pas dépendre de l'ordre que veut bien rendre l'API Storage.

/** Un média prêt à être envoyé à la plateforme. */
export interface JobMedia {
  mediaAssetId: string
  kind: "image" | "video"
  /** URL signée 48 h. ⚠ SECRET — jamais journalisée (elle porte un JWT). */
  url: string
  mimeType: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  byteSize: number | null
  /** `content_media.alt_text_override` sinon `media_assets.alt_text`. */
  altText: string | null
}

interface MediaRow extends Record<string, unknown> {
  media_asset_id: string
  type: "image" | "video"
  storage_path: string | null
  original_deleted_at: Date | null
  mime_type: string | null
  byte_size: string | number | null
  width: number | null
  height: number | null
  duration_ms: number | null
  alt_text: string | null
}

/**
 * Lit les médias d'un contenu, ordonnés. Aucune signature ici : la lecture est
 * séparée de l'appel réseau, parce que c'est la lecture qui décide si le job est
 * publiable et l'appel réseau qui peut échouer transitoirement.
 */
export async function loadJobMedia(pool: Queryable, job: PublishJob): Promise<MediaRow[]> {
  const { rows } = await pool.query<MediaRow>(
    `select cm.media_asset_id,
            ma.type,
            ma.storage_path,
            ma.original_deleted_at,
            ma.mime_type,
            ma.byte_size,
            ma.width,
            ma.height,
            ma.duration_ms,
            coalesce(cm.alt_text_override, ma.alt_text) as alt_text
     from public.content_media cm
     join public.media_assets ma on ma.id = cm.media_asset_id
     where cm.content_item_id = $1
     -- cm.id en second critère : position est unique par contenu, mais un ordre
     -- total explicite coûte zéro et garantit qu'un carrousel ne sortira jamais
     -- dans deux ordres différents entre deux tentatives.
     order by cm.position asc, cm.id asc`,
    [job.contentItemId]
  )
  return rows
}

/**
 * Résout et signe les médias d'un job.
 *
 * Les deux modes d'échec ne se valent pas, et c'est tout l'objet du découpage
 * (règle 18) :
 *
 *   PERMANENT — le fichier n'existera jamais : `storage_path` nul, ou original
 *   purgé (rétention J+7, 012:44). Retenter cinq fois ne le ressuscite pas ;
 *   `failed` direct, l'admin doit re-téléverser.
 *
 *   TRANSITOIRE — la signature a échoué : Storage momentanément indisponible,
 *   5xx, réseau. Le fichier est là. C'est un retry, pas un `failed` : classer
 *   permanent une panne de Storage condamnerait des contenus parfaitement sains
 *   à la première minute d'indisponibilité du service. (`StorageSignError`,
 *   voir storage-signer.ts — elle n'hérite PAS de PermanentPublishError.)
 */
export async function resolveJobMedia(
  pool: Queryable,
  job: PublishJob,
  signer: StorageSigner
): Promise<JobMedia[]> {
  const rows = await loadJobMedia(pool, job)
  if (rows.length === 0) return []

  for (const row of rows) {
    if (row.original_deleted_at !== null) {
      throw new PermanentPublishError(
        `media ${row.media_asset_id}: original purge (retention), republication impossible`
      )
    }
    if (!row.storage_path) {
      throw new PermanentPublishError(
        `media ${row.media_asset_id}: aucun fichier original (storage_path nul)`
      )
    }
  }

  const paths = rows.map((r) => r.storage_path as string)
  const urls = await signer.sign(paths, SIGNED_URL_TTL_SECONDS)

  return rows.map((row, i) => ({
    mediaAssetId: row.media_asset_id,
    kind: row.type,
    url: urls[i] as string,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    // `bigint` revient en string via node-postgres : le convertir ici évite un
    // `"12" > 8` silencieusement faux dans une comparaison de taille.
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    altText: row.alt_text,
  }))
}
