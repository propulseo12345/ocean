import assert from "node:assert/strict"
import { test } from "node:test"
import type { Queryable } from "../db/queryable"
import { PermanentPublishError, type PublishJob } from "../domain"
import type { FetchLike } from "../http"
import { resolveJobMedia } from "./signed-urls"
import {
  createStorageSigner,
  ORIGINALS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  StorageSignError,
} from "./storage-signer"

// T1-1 — l'URL signée 48 h. Aucun réseau, aucune base : le pool est un faux qui
// rend des lignes, le transport est un faux qui rend les formes de réponse de
// l'API Storage.
//
// Ce que ces tests refusent de laisser passer :
//   - un carrousel publié dans le désordre ;
//   - une panne de Storage classée « média invalide » (donc failed sans retry) ;
//   - un original purgé traité comme retryable (5 tentatives pour rien) ;
//   - un TTL raccourci par mégarde.

const JOB = { contentItemId: "item-1" } as PublishJob

function poolOf(rows: Record<string, unknown>[]): Queryable {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: faux de test, une seule requête
    query: async (_sql: string, _params?: unknown[]) => ({ rows: rows as any }),
  }
}

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    media_asset_id: "asset-1",
    type: "image",
    storage_path: "org/client/up/photo.jpg",
    original_deleted_at: null,
    mime_type: "image/jpeg",
    byte_size: "1048576",
    width: 1080,
    height: 1350,
    duration_ms: null,
    alt_text: null,
    ...over,
  }
}

/** Faux Storage : répond la forme documentée, dans l'ordre qu'on lui demande. */
function fakeStorage(opts: { shuffle?: boolean; status?: number; errorFor?: string } = {}) {
  const calls: { url: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { expiresIn: number; paths: string[] }
    calls.push({ url, body })
    if (opts.status && opts.status !== 200) {
      return new Response("storage down", { status: opts.status })
    }
    const entries = body.paths.map((p) => ({
      error: opts.errorFor === p ? "Object not found" : null,
      path: p,
      signedURL: `/object/sign/${ORIGINALS_BUCKET}/${p}?token=jwt-${p}`,
    }))
    // L'API ne PROMET pas l'ordre : on vérifie que le code n'en dépend pas.
    if (opts.shuffle) entries.reverse()
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  return { fetch, calls }
}

function signerOf(fetch: FetchLike) {
  return createStorageSigner({
    supabaseUrl: "https://projet.supabase.co",
    serviceRoleKey: "service-role-key",
    fetch,
  })
}

test("un media simple : URL absolue, TTL 48 h, metadonnees remontees", async () => {
  const storage = fakeStorage()
  const media = await resolveJobMedia(poolOf([row()]), JOB, signerOf(storage.fetch))

  assert.equal(media.length, 1)
  assert.equal(
    media[0]?.url,
    "https://projet.supabase.co/storage/v1/object/sign/media-originals/org/client/up/photo.jpg?token=jwt-org/client/up/photo.jpg"
  )
  assert.equal(media[0]?.kind, "image")
  assert.equal(media[0]?.width, 1080)
  // bigint node-postgres = string : sans conversion, toute comparaison de poids
  // serait une comparaison de chaines.
  assert.equal(media[0]?.byteSize, 1_048_576)
  assert.equal(typeof media[0]?.byteSize, "number")

  const sent = storage.calls[0]?.body as { expiresIn: number }
  assert.equal(sent.expiresIn, SIGNED_URL_TTL_SECONDS)
  assert.equal(SIGNED_URL_TTL_SECONDS, 172_800, "48 h : le retry doit rester couvert")
})

test("carrousel : l'ordre de content_media est conserve, meme si Storage repond en desordre", async () => {
  const rows = [
    row({ media_asset_id: "a", storage_path: "p/0.jpg" }),
    row({ media_asset_id: "b", storage_path: "p/1.jpg" }),
    row({ media_asset_id: "c", storage_path: "p/2.jpg" }),
  ]
  const storage = fakeStorage({ shuffle: true })
  const media = await resolveJobMedia(poolOf(rows), JOB, signerOf(storage.fetch))

  assert.deepEqual(
    media.map((m) => m.mediaAssetId),
    ["a", "b", "c"]
  )
  // Chaque URL est bien CELLE de son media, pas celle du voisin.
  for (const m of media) {
    assert.ok(m.url.includes(`token=jwt-p/${["a", "b", "c"].indexOf(m.mediaAssetId)}.jpg`), m.url)
  }
})

test("Storage indisponible => TRANSITOIRE (retry), surtout pas permanent", async () => {
  const storage = fakeStorage({ status: 503 })
  await assert.rejects(
    () => resolveJobMedia(poolOf([row()]), JOB, signerOf(storage.fetch)),
    (err: unknown) => {
      assert.ok(err instanceof StorageSignError, "doit etre une erreur de signature")
      assert.ok(
        !(err instanceof PermanentPublishError),
        "un Storage momentanement KO ne doit JAMAIS produire un failed definitif"
      )
      return true
    }
  )
})

test("reseau coupe pendant la signature => transitoire aussi", async () => {
  const fetch: FetchLike = async () => {
    throw new TypeError("fetch failed")
  }
  await assert.rejects(
    () => resolveJobMedia(poolOf([row()]), JOB, signerOf(fetch)),
    (err: unknown) => err instanceof StorageSignError && !(err instanceof PermanentPublishError)
  )
})

test("objet absent du bucket => PERMANENT (retenter ne le fera pas apparaitre)", async () => {
  const storage = fakeStorage({ errorFor: "org/client/up/photo.jpg" })
  await assert.rejects(
    () => resolveJobMedia(poolOf([row()]), JOB, signerOf(storage.fetch)),
    (err: unknown) => err instanceof PermanentPublishError
  )
})

test("original purge (retention J+7) => PERMANENT, et aucune signature tentee", async () => {
  const storage = fakeStorage()
  await assert.rejects(
    () =>
      resolveJobMedia(
        poolOf([row({ original_deleted_at: new Date("2026-08-01T00:00:00Z") })]),
        JOB,
        signerOf(storage.fetch)
      ),
    (err: unknown) => err instanceof PermanentPublishError
  )
  assert.equal(storage.calls.length, 0, "inutile d'appeler Storage pour un fichier purge")
})

test("storage_path nul (import feed sans original) => PERMANENT", async () => {
  const storage = fakeStorage()
  await assert.rejects(
    () => resolveJobMedia(poolOf([row({ storage_path: null })]), JOB, signerOf(storage.fetch)),
    (err: unknown) => err instanceof PermanentPublishError
  )
  assert.equal(storage.calls.length, 0)
})

test("contenu sans media : tableau vide, aucun appel Storage (la decision revient au publisher)", async () => {
  const storage = fakeStorage()
  const media = await resolveJobMedia(poolOf([]), JOB, signerOf(storage.fetch))
  assert.deepEqual(media, [])
  assert.equal(storage.calls.length, 0)
})

test("reponse tronquee (moins d'entrees que de chemins) => transitoire, jamais d'URL inventee", async () => {
  const fetch: FetchLike = async () =>
    new Response(JSON.stringify([{ error: null, path: "p/0.jpg", signedURL: "/x?token=t" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  const rows = [row({ storage_path: "p/0.jpg" }), row({ storage_path: "p/1.jpg" })]
  await assert.rejects(
    () => resolveJobMedia(poolOf(rows), JOB, signerOf(fetch)),
    (err: unknown) => err instanceof StorageSignError
  )
})

test("l'URL signee n'apparait dans aucun message d'erreur", async () => {
  // Meme forme que le fake, mais l'entree porte une erreur : le message doit
  // citer le CHEMIN, jamais un jeton.
  const storage = fakeStorage({ errorFor: "org/client/up/photo.jpg" })
  await assert.rejects(
    () => resolveJobMedia(poolOf([row()]), JOB, signerOf(storage.fetch)),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(!msg.includes("token="), `un jeton a fuite dans le message: ${msg}`)
      assert.ok(msg.includes("org/client/up/photo.jpg"))
      return true
    }
  )
})
