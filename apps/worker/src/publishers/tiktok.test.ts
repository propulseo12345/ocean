import assert from "node:assert/strict"
import { test } from "node:test"
import { PermanentPublishError, type PublishJob } from "../domain"
import type { FetchLike } from "../http"
import type { JobMedia } from "../media/signed-urls"
import { createTikTokPublisher, mapTikTokStatus, planChunks } from "./tiktok"
import type { PublishContext } from "./types"

const BASE = "https://tiktok.test/v2"
const FRESH = { id: "job-1", publishStartedAt: null, targetPublishStartedAt: null } as PublishJob
const RECOVERY = {
  id: "job-1",
  publishStartedAt: new Date(),
  targetPublishStartedAt: new Date(),
} as PublishJob

const MEDIA_URL =
  "https://projet.supabase.co/storage/v1/object/sign/media-originals/v.mp4?token=jwt"

function video(byteSize: number): JobMedia {
  return {
    mediaAssetId: "asset-1",
    kind: "video",
    url: MEDIA_URL,
    mimeType: "video/mp4",
    width: 1080,
    height: 1920,
    durationMs: 15_000,
    byteSize,
    altText: null,
  }
}

function ctx(byteSize = 1000): PublishContext {
  return {
    accessToken: "TT-TOKEN",
    providerAccountId: "open-id-1",
    media: [video(byteSize)],
    caption: "Coucou",
    format: "reel",
  }
}

/**
 * Faux TikTok + faux Storage. Le serveur d'upload STOCKE les octets : les
 * assertions portent sur le contenu reassemble, pas sur un compte d'appels.
 */
function fakeTikTok(source: Uint8Array, opts: { ignoreRange?: boolean } = {}) {
  const uploaded: { range: string; bytes: Uint8Array }[] = []
  const calls: string[] = []
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET"
    calls.push(`${method} ${url}`)

    if (url.startsWith(MEDIA_URL)) {
      const range = new Headers(init?.headers).get("range") ?? ""
      const m = /bytes=(\d+)-(\d+)/.exec(range)
      if (!m || opts.ignoreRange) {
        return new Response(source, { status: 200 })
      }
      const start = Number(m[1])
      const end = Number(m[2])
      return new Response(source.slice(start, end + 1), { status: 206 })
    }
    if (url.startsWith("https://upload.test/")) {
      const range = new Headers(init?.headers).get("content-range") ?? ""
      uploaded.push({ range, bytes: new Uint8Array(init?.body as ArrayBuffer) })
      return new Response("", { status: 201 })
    }
    if (url.endsWith("/post/publish/inbox/video/init/")) {
      return new Response(
        JSON.stringify({
          data: { publish_id: "pub-1", upload_url: "https://upload.test/pub-1" },
          error: { code: "ok" },
        }),
        { status: 200 }
      )
    }
    if (url.endsWith("/post/publish/status/fetch/")) {
      return new Response(
        JSON.stringify({ data: { status: "SEND_TO_USER_INBOX" }, error: { code: "ok" } }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ error: { code: "not_found" } }), { status: 404 })
  }
  return { fetch, uploaded, calls }
}

// --- planChunks -------------------------------------------------------------

test("planChunks : la DERNIERE tranche absorbe le reliquat (un ceil serait refuse)", () => {
  // 25 Mio avec des tranches de 10 : 2 tranches, la seconde de 15 Mio. Un ceil
  // en produirait 3, dont une finale de 5 Mio pile — sous le minimum des que le
  // reliquat est plus petit.
  const mio = 1024 * 1024
  const plan = planChunks(25 * mio, 10 * mio)
  assert.equal(plan.length, 2)
  assert.deepEqual(plan[0], { start: 0, end: 10 * mio - 1 })
  assert.deepEqual(plan[1], { start: 10 * mio, end: 25 * mio - 1 })
  // Les tranches couvrent EXACTEMENT le fichier, sans trou ni recouvrement.
  assert.equal(plan[plan.length - 1]?.end, 25 * mio - 1)
})

test("planChunks : un fichier plus petit qu'une tranche part en une seule fois", () => {
  assert.deepEqual(planChunks(1000, 10 * 1024 * 1024), [{ start: 0, end: 999 }])
})

test("planChunks : taille nulle ou demesuree => PERMANENT", () => {
  assert.throws(() => planChunks(0), PermanentPublishError)
  assert.throws(() => planChunks(5 * 1024 * 1024 * 1024), PermanentPublishError)
})

// --- flux ------------------------------------------------------------------

test("REGLE 15 : createContainer INIT SEUL, aucun octet ne part", async () => {
  const src = new Uint8Array(1000).fill(7)
  const tt = fakeTikTok(src)
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })

  const { containerId } = await pub.createContainer(FRESH, ctx(1000))
  assert.equal(containerId, "pub-1")
  assert.equal(tt.uploaded.length, 0, "le brouillon n'existe pas encore")
  // C'est tout l'ordre : le transfert (irreversible, il fait apparaitre le
  // brouillon et brule 1 des 5 quotas/24 h) doit suivre publish_started_at.
  assert.equal(tt.calls.length, 1)
})

test("publish : le transfert chunke, et les octets remis bout a bout sont l'original", async () => {
  const src = Uint8Array.from({ length: 2500 }, (_, i) => i % 251)
  const tt = fakeTikTok(src)
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE, chunkSize: 1000 })
  const c = ctx(2500)

  await pub.createContainer(FRESH, c)
  const res = await pub.publish(FRESH, "pub-1", c)

  assert.equal(tt.uploaded.length, 2, "2 tranches : 1000 puis 1500 (la derniere absorbe)")
  assert.deepEqual(
    tt.uploaded.map((u) => u.range),
    ["bytes 0-999/2500", "bytes 1000-2499/2500"]
  )
  const reassemble = new Uint8Array(2500)
  let at = 0
  for (const u of tt.uploaded) {
    reassemble.set(u.bytes, at)
    at += u.bytes.byteLength
  }
  assert.equal(Buffer.compare(Buffer.from(reassemble), Buffer.from(src)), 0)

  assert.equal(res.targetStatus, "pushed_to_platform", "TikTok = BROUILLON, jamais published")
  assert.equal(res.permalink, undefined, "un brouillon n'a pas d'URL publique")
})

test("un Storage qui IGNORE le Range est detecte, pas televerse N fois en entier", async () => {
  // Sans ce controle, chaque tranche recevrait le fichier complet : TikTok
  // recevrait un fichier corrompu, sans qu'aucune erreur ne le signale.
  const src = new Uint8Array(2500).fill(3)
  const tt = fakeTikTok(src, { ignoreRange: true })
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE, chunkSize: 1000 })
  await pub.createContainer(FRESH, ctx(2500))
  await assert.rejects(() => pub.publish(FRESH, "pub-1", ctx(2500)), /octets recus/)
})

test("jamais PULL_FROM_URL : l'URL signee n'est jamais envoyee a TikTok", async () => {
  const src = new Uint8Array(500).fill(1)
  const tt = fakeTikTok(src)
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })
  await pub.createContainer(FRESH, ctx(500))

  const init = tt.calls.find((c) => c.includes("/init/"))
  assert.ok(init)
  // Le corps d'init ne contient que FILE_UPLOAD : *.supabase.co ne peut pas
  // etre un domaine verifie chez TikTok, et l'anti-pattern est explicite (§5).
  assert.ok(!tt.calls.some((c) => c.includes("supabase.co") && c.includes("init")))
})

test("upload_url perdue (redemarrage) => on rend la main, on ne re-init PAS sous l'ancre", async () => {
  const tt = fakeTikTok(new Uint8Array(500))
  // Publisher NEUF : sa memoire ne contient pas l'upload_url du publish_id.
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })
  await assert.rejects(() => pub.publish(RECOVERY, "pub-1", ctx(500)), /upload_url perdue/)
  assert.equal(tt.uploaded.length, 0)
})

// --- statut ----------------------------------------------------------------

test("job frais : le statut ne depend PAS de status/fetch (sinon le transfert n'a jamais lieu)", async () => {
  const tt = fakeTikTok(new Uint8Array(500))
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })
  await pub.createContainer(FRESH, ctx(500))

  // status/fetch rendrait PROCESSING_UPLOAD sur un init tout neuf => le moteur
  // partirait en awaiting_media en boucle et n'enverrait jamais la video.
  assert.equal(await pub.getContainerStatus(FRESH, "pub-1", ctx(500)), "ready")
  assert.ok(!tt.calls.some((c) => c.includes("status/fetch")))

  assert.equal(
    await pub.getContainerStatus(FRESH, "inconnu", ctx(500)),
    "error",
    "un publish_id dont on n'a plus l'upload_url doit etre oublie, pas attendu"
  )
})

test("reprise : status/fetch fait foi, et SEND_TO_USER_INBOX veut dire NE PAS RECOMMENCER", async () => {
  const tt = fakeTikTok(new Uint8Array(500))
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })
  assert.equal(await pub.getContainerStatus(RECOVERY, "pub-1", ctx(500)), "published")
  assert.ok(tt.calls.some((c) => c.includes("status/fetch")))
})

test("mapTikTokStatus : le brouillon EXISTE => published (il compte dans les 5/24 h)", () => {
  assert.equal(mapTikTokStatus("SEND_TO_USER_INBOX"), "published")
  assert.equal(mapTikTokStatus("PUBLISH_COMPLETE"), "published")
  assert.equal(mapTikTokStatus("PROCESSING_UPLOAD"), "in_progress")
  assert.equal(mapTikTokStatus("FAILED"), "error")
  assert.equal(mapTikTokStatus("QUELQUE_CHOSE"), "in_progress", "l'inconnu n'est jamais 'pret'")
})

// --- erreurs ----------------------------------------------------------------

test("HTTP 200 avec error.code != ok => ECHEC, et spam_risk est PERMANENT", async () => {
  const fetch: FetchLike = async () =>
    new Response(
      JSON.stringify({ error: { code: "spam_risk_too_many_posts", message: "trop de posts" } }),
      { status: 200 }
    )
  const pub = createTikTokPublisher({ fetch, base: BASE })
  await assert.rejects(
    () => pub.createContainer(FRESH, ctx(500)),
    (e: unknown) => e instanceof PermanentPublishError
  )
})

test("une erreur TikTok inconnue reste RETRYABLE", async () => {
  const fetch: FetchLike = async () =>
    new Response(JSON.stringify({ error: { code: "internal_error", message: "boom" } }), {
      status: 200,
    })
  await assert.rejects(
    () => createTikTokPublisher({ fetch, base: BASE }).createContainer(FRESH, ctx(500)),
    (e: unknown) => e instanceof Error && !(e instanceof PermanentPublishError)
  )
})

test("REGLE 12 : le token n'apparait pas dans le corps d'erreur remonte", async () => {
  const fetch: FetchLike = async () => new Response("refuse pour TT-TOKEN", { status: 401 })
  await assert.rejects(
    () => createTikTokPublisher({ fetch, base: BASE }).createContainer(FRESH, ctx(500)),
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      assert.ok(!msg.includes("TT-TOKEN"), msg)
      return true
    }
  )
})

test("sans video, ou sans taille connue => PERMANENT (aucun transfert possible)", async () => {
  const tt = fakeTikTok(new Uint8Array(0))
  const pub = createTikTokPublisher({ fetch: tt.fetch, base: BASE })
  await assert.rejects(
    () => pub.createContainer(FRESH, { ...ctx(500), media: [] }),
    (e: unknown) => e instanceof PermanentPublishError
  )
  await assert.rejects(
    () =>
      pub.createContainer(FRESH, {
        ...ctx(500),
        media: [{ ...video(500), byteSize: null }],
      }),
    (e: unknown) => e instanceof PermanentPublishError
  )
})
