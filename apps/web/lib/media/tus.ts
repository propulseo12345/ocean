// Client TUS 1.0.0 pour `/storage/v1/upload/resumable` (Supabase Storage).
//
// POURQUOI UN CLIENT ÉCRIT ICI, ET PAS `tus-js-client`
// ----------------------------------------------------
// Trois propriétés de ce module doivent être PROUVÉES, pas supposées :
//   1. les tranches font exactement 6 Mio — Supabase l'exige, et une tranche
//      d'une autre taille est acceptée par le POST puis rejetée au PATCH, donc
//      l'erreur arrive après un transfert déjà payé ;
//   2. la reprise repart de l'offset que le SERVEUR annonce, jamais de celui
//      qu'on croit avoir envoyé ;
//   3. l'annulation n'écrit pas la tranche en cours.
// `tus-js-client` est conçu pour le navigateur et n'est pas exécutable sous
// `node --test` (le seul harnais de `apps/web`). Un client dont `fetch` est
// injectable l'est — c'est la différence entre une garantie relue et une
// garantie exécutée, et c'est exactement le motif des faux positifs de la
// semaine.
//
// La conséquence : `tus.test.ts` exerce ce fichier pour de vrai, avec un serveur
// TUS factice qui compte les octets et vérifie la taille de chaque tranche.

/** Taille de tranche imposée par Supabase Storage : 6 Mio, pas 6 Mo. */
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024

const TUS_VERSION = "1.0.0"
const MAX_RETRIES_PAR_TRANCHE = 3

export class TusError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "TusError"
    this.status = status
  }
}

export class TusAbortError extends Error {
  constructor() {
    super("upload annulé")
    this.name = "TusAbortError"
  }
}

export interface TusUploadInput {
  /** `{supabaseUrl}/storage/v1/upload/resumable`. */
  endpoint: string
  bucket: string
  /** Chemin de l'objet DANS le bucket (sans le nom du bucket). */
  objectName: string
  blob: Blob
  contentType: string
  /** Jeton de session de l'UTILISATEUR : c'est la policy RLS qui tranche. */
  accessToken: string
  apiKey: string
  upsert?: boolean
  /** URL d'un upload déjà créé, pour reprendre après coupure. */
  resumeUrl?: string | null
  /** Appelé dès que l'URL de reprise est connue (à mémoriser côté appelant). */
  onResumeUrl?: (url: string) => void
  onProgress?: (sentBytes: number, totalBytes: number) => void
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export interface TusUploadResult {
  uploadUrl: string
  bytesSent: number
}

/** base64 d'une valeur UTF-8 (les noms de fichiers accentués sont la norme ici). */
function b64(value: string): string {
  const octets = new TextEncoder().encode(value)
  let binaire = ""
  for (const o of octets) binaire += String.fromCharCode(o)
  return btoa(binaire)
}

function encodeMetadata(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([clé, valeur]) => `${clé} ${b64(valeur)}`)
    .join(",")
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new TusAbortError()
}

/** L'offset renvoyé par le serveur fait foi ; une valeur illisible est une erreur. */
function readOffset(res: Response): number {
  const brut = res.headers.get("Upload-Offset")
  const valeur = brut === null ? Number.NaN : Number(brut)
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new TusError(`Upload-Offset illisible: ${String(brut)}`, res.status)
  }
  return valeur
}

/**
 * Crée l'upload côté serveur et renvoie son URL.
 *
 * `x-upsert` est posé à la CRÉATION : c'est là que Supabase décide si un objet
 * existant peut être écrasé. Par défaut `false` — un chemin porte une clé
 * d'upload tirée au hasard, donc une collision signale un bug, pas un remplacement.
 */
async function créerUpload(input: TusUploadInput, f: typeof fetch): Promise<string> {
  const res = await f(input.endpoint, {
    method: "POST",
    headers: {
      "Tus-Resumable": TUS_VERSION,
      "Upload-Length": String(input.blob.size),
      "Upload-Metadata": encodeMetadata({
        bucketName: input.bucket,
        objectName: input.objectName,
        contentType: input.contentType,
        cacheControl: "3600",
      }),
      authorization: `Bearer ${input.accessToken}`,
      apikey: input.apiKey,
      "x-upsert": input.upsert ? "true" : "false",
    },
    signal: input.signal,
  })
  if (res.status !== 201) {
    throw new TusError(`création refusée: ${res.status} ${await res.text()}`, res.status)
  }
  const location = res.headers.get("Location")
  if (!location) throw new TusError("création sans en-tête Location", res.status)
  // Une Location relative est légale en TUS : on la résout contre l'endpoint.
  return new URL(location, input.endpoint).toString()
}

/** Offset courant d'un upload existant. `null` = l'upload n'existe plus. */
async function offsetDistant(
  uploadUrl: string,
  input: TusUploadInput,
  f: typeof fetch
): Promise<number | null> {
  const res = await f(uploadUrl, {
    method: "HEAD",
    headers: {
      "Tus-Resumable": TUS_VERSION,
      authorization: `Bearer ${input.accessToken}`,
      apikey: input.apiKey,
    },
    signal: input.signal,
  })
  if (res.status === 404 || res.status === 410 || res.status === 403) return null
  if (!res.ok) throw new TusError(`HEAD refusé: ${res.status}`, res.status)
  return readOffset(res)
}

/**
 * Téléverse `blob` par tranches de 6 Mio, en reprenant là où le serveur en est.
 *
 * L'offset n'est jamais déduit de ce qu'on croit avoir envoyé : il vient du
 * serveur à chaque tranche. C'est ce qui rend la reprise sûre — une tranche
 * partiellement reçue puis coupée laisse le serveur à un offset intermédiaire,
 * et repartir de `offset + 6 Mio` écrirait un trou dans le fichier.
 */
export async function uploadResumable(input: TusUploadInput): Promise<TusUploadResult> {
  const f = input.fetchImpl ?? fetch
  const total = input.blob.size
  throwIfAborted(input.signal)

  let uploadUrl = input.resumeUrl ?? null
  let offset = 0

  if (uploadUrl) {
    const distant = await offsetDistant(uploadUrl, input, f)
    if (distant === null) uploadUrl = null
    else offset = distant
  }
  if (!uploadUrl) {
    uploadUrl = await créerUpload(input, f)
    offset = 0
  }
  input.onResumeUrl?.(uploadUrl)
  input.onProgress?.(offset, total)

  let échecsConsécutifs = 0
  while (offset < total) {
    throwIfAborted(input.signal)
    // Dernière tranche exceptée, toutes font exactement TUS_CHUNK_SIZE.
    const fin = Math.min(offset + TUS_CHUNK_SIZE, total)
    const tranche = input.blob.slice(offset, fin)

    let res: Response
    try {
      res = await f(uploadUrl, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": TUS_VERSION,
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
          authorization: `Bearer ${input.accessToken}`,
          apikey: input.apiKey,
        },
        body: tranche,
        signal: input.signal,
      })
    } catch (err) {
      throwIfAborted(input.signal)
      if (++échecsConsécutifs > MAX_RETRIES_PAR_TRANCHE) throw err
      const resync = await offsetDistant(uploadUrl, input, f)
      if (resync === null) throw new TusError("upload perdu côté serveur", 410)
      offset = resync
      continue
    }

    // 409 = notre offset ne correspond pas à celui du serveur (tranche reçue
    // en double, ou coupure au milieu). On resynchronise au lieu d'insister.
    if (res.status === 409) {
      if (++échecsConsécutifs > MAX_RETRIES_PAR_TRANCHE) {
        throw new TusError("offset désynchronisé", res.status)
      }
      const resync = await offsetDistant(uploadUrl, input, f)
      if (resync === null) throw new TusError("upload perdu côté serveur", 410)
      offset = resync
      continue
    }
    if (res.status !== 204 && res.status !== 200) {
      throw new TusError(`tranche refusée: ${res.status} ${await res.text()}`, res.status)
    }

    échecsConsécutifs = 0
    offset = readOffset(res)
    input.onProgress?.(offset, total)
  }

  return { uploadUrl, bytesSent: offset }
}
