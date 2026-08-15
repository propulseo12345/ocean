import assert from "node:assert/strict"
import { test } from "node:test"
import { NeedsReauthError, PermanentPublishError, type PublishJob } from "../domain"
import type { FetchLike } from "../http"
import type { JobMedia } from "../media/signed-urls"
import { createFacebookPublisher, mapReelStatus, TEXT_ONLY_CONTAINER } from "./facebook"
import type { PublishContext } from "./types"

const BASE = "https://graph.test/v21.0"
const FRESH = { id: "job-1", publishStartedAt: null, targetPublishStartedAt: null } as PublishJob
/** Job en REPRISE : l'ancre de la règle 15 est posée, un POST est peut-être parti. */
const RECOVERY = {
  id: "job-1",
  publishStartedAt: new Date(),
  targetPublishStartedAt: new Date(),
} as PublishJob

function media(over: Partial<JobMedia> = {}): JobMedia {
  return {
    mediaAssetId: "asset-1",
    kind: "image",
    url: "https://projet.supabase.co/storage/v1/object/sign/media-originals/a.jpg?token=jwt",
    mimeType: "image/jpeg",
    width: 1200,
    height: 900,
    durationMs: null,
    byteSize: 1000,
    altText: null,
    ...over,
  }
}

function ctx(over: Partial<PublishContext> = {}): PublishContext {
  return {
    accessToken: "PAGE-TOKEN",
    providerAccountId: "1122334455",
    media: [media()],
    caption: "Coucou",
    format: "post",
    ...over,
  }
}

function fakeGraph(routes: { match: string; body: unknown; status?: number; headers?: Record<string, string> }[]) {
  const calls: { method: string; url: string; body?: string; headers: Headers }[] = []
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET"
    calls.push({
      method,
      url,
      body: init?.body ? String(init.body) : undefined,
      headers: new Headers(init?.headers),
    })
    const key = `${method} ${url.startsWith(BASE) ? url.slice(BASE.length + 1) : url}`
    for (const r of routes) {
      if (key.includes(r.match)) {
        return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers })
      }
    }
    return new Response(JSON.stringify({ error: { message: `inconnu: ${key}`, code: 100 } }), {
      status: 404,
    })
  }
  return { fetch, calls }
}

test("photo : televersee NON publiee, puis /feed — c'est ce decoupage qui donne un conteneur", async () => {
  const g = fakeGraph([
    { match: "POST 1122334455/photos", body: { id: "photo-1" } },
    { match: "POST 1122334455/feed", body: { id: "1122334455_999" } },
  ])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })

  const { containerId } = await pub.createContainer(FRESH, ctx())
  assert.equal(containerId, "photo-1")
  const photoBody = new URLSearchParams(g.calls[0]?.body ?? "")
  assert.equal(photoBody.get("published"), "false", "la creation du conteneur ne publie RIEN")

  const res = await pub.publish(FRESH, containerId, ctx())
  const feedBody = new URLSearchParams(g.calls[1]?.body ?? "")
  assert.equal(feedBody.get("attached_media[0]"), '{"media_fbid":"photo-1"}')
  assert.equal(feedBody.get("message"), "Coucou")
  assert.equal(res.externalPostId, "1122334455_999")
  assert.equal(res.targetStatus, "published")
})

test("plusieurs photos : un seul post, dans l'ordre de content_media", async () => {
  let n = 0
  const g = fakeGraph([
    {
      match: "POST 1122334455/photos",
      get body() {
        n += 1
        return { id: `photo-${n}` }
      },
    },
    { match: "POST 1122334455/feed", body: { id: "p_1" } },
  ])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })
  const c = ctx({ media: [media({ mediaAssetId: "a" }), media({ mediaAssetId: "b" })] })

  const { containerId } = await pub.createContainer(FRESH, c)
  assert.equal(containerId, "photo-1,photo-2")
  await pub.publish(FRESH, containerId, c)
  const body = new URLSearchParams(g.calls[2]?.body ?? "")
  assert.equal(body.get("attached_media[0]"), '{"media_fbid":"photo-1"}')
  assert.equal(body.get("attached_media[1]"), '{"media_fbid":"photo-2"}')
})

test("reel : start -> rupload par file_url -> finish (3 temps)", async () => {
  const g = fakeGraph([
    {
      match: "POST 1122334455/video_reels",
      body: { video_id: "v-1", upload_url: "https://rupload.test/v-1" },
    },
    { match: "POST https://rupload.test/v-1", body: { success: true } },
  ])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })
  const c = ctx({ format: "reel", media: [media({ kind: "video" })] })

  const { containerId } = await pub.createContainer(FRESH, c)
  assert.equal(containerId, "v-1")
  assert.equal(new URLSearchParams(g.calls[0]?.body ?? "").get("upload_phase"), "start")
  // L'upload « hosted file » : Meta va chercher notre URL signee 48 h.
  assert.ok(g.calls[1]?.headers.get("file_url")?.includes("media-originals"))
  assert.equal(g.calls[1]?.headers.get("authorization"), "OAuth PAGE-TOKEN")
})

test("reel : la phase finish porte video_state=PUBLISHED (rien n'est publie avant)", async () => {
  const g = fakeGraph([{ match: "POST 1122334455/video_reels", body: { post_id: "1122_777" } }])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })
  const res = await pub.publish(FRESH, "v-1", ctx({ format: "reel", media: [media({ kind: "video" })] }))

  const body = new URLSearchParams(g.calls[0]?.body ?? "")
  assert.equal(body.get("upload_phase"), "finish")
  assert.equal(body.get("video_state"), "PUBLISHED")
  assert.equal(body.get("video_id"), "v-1")
  assert.equal(res.externalPostId, "1122_777")
})

test("post SANS media : conteneur fictif, et /feed avec le seul message", async () => {
  const g = fakeGraph([{ match: "POST 1122334455/feed", body: { id: "1122_1" } }])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })
  const c = ctx({ media: [] })

  const { containerId } = await pub.createContainer(FRESH, c)
  assert.equal(containerId, TEXT_ONLY_CONTAINER)
  assert.equal(g.calls.length, 0, "aucun appel : il n'y a rien a preparer")

  const res = await pub.publish(FRESH, containerId, c)
  assert.equal(new URLSearchParams(g.calls[0]?.body ?? "").get("message"), "Coucou")
  assert.equal(res.externalPostId, "1122_1")
})

test("LA QUESTION N'EST PAS LA MEME selon l'etat du job — post texte", async () => {
  const g = fakeGraph([])
  const pub = createFacebookPublisher({ fetch: g.fetch, base: BASE })
  const c = ctx({ media: [] })

  // Job FRAIS : rien n'est parti, le conteneur fictif est publiable.
  assert.equal(await pub.getContainerStatus(FRESH, TEXT_ONLY_CONTAINER, c), "ready")

  // REPRISE : indecidable. On le DIT, et l'erreur permanente sur un job ancre
  // produit `needs_verification` (024) — ni doublon, ni faux echec.
  await assert.rejects(
    () => pub.getContainerStatus(RECOVERY, TEXT_ONLY_CONTAINER, c),
    (e: unknown) => e instanceof PermanentPublishError
  )
  assert.equal(g.calls.length, 0)
})

test("photo : page_story_id est la PREUVE de publication (regle 15)", async () => {
  const publie = fakeGraph([
    { match: "GET photo-1", body: { id: "photo-1", page_story_id: "1122_999" } },
  ])
  const pas = fakeGraph([{ match: "GET photo-1", body: { id: "photo-1" } }])

  assert.equal(
    await createFacebookPublisher({ fetch: publie.fetch, base: BASE }).getContainerStatus(
      RECOVERY,
      "photo-1",
      ctx()
    ),
    "published"
  )
  assert.equal(
    await createFacebookPublisher({ fetch: pas.fetch, base: BASE }).getContainerStatus(
      RECOVERY,
      "photo-1",
      ctx()
    ),
    "ready",
    "sans page_story_id la photo n'a rejoint aucun post : republier est sur"
  )
})

test("mapReelStatus : PUBLISHED n'est pas READY", () => {
  assert.equal(mapReelStatus("PUBLISHED"), "published")
  assert.equal(mapReelStatus("ready"), "ready")
  assert.equal(mapReelStatus("processing"), "in_progress")
  assert.equal(mapReelStatus("error"), "error")
  assert.equal(mapReelStatus(undefined), "in_progress", "l'inconnu n'est jamais 'pret'")
})

test("l'en-tete de charge (BUC) est remonte a chaque appel — le quota FB se lit EN SORTIE", async () => {
  const vu: (string | null)[] = []
  const g = fakeGraph([
    {
      match: "POST 1122334455/photos",
      body: { id: "photo-1" },
      headers: { "x-business-use-case-usage": '{"1122334455":[{"call_count":12}]}' },
    },
  ])
  await createFacebookPublisher({
    fetch: g.fetch,
    base: BASE,
    onUsage: (h) => vu.push(h),
  }).createContainer(FRESH, ctx())

  assert.equal(vu.length, 1)
  assert.ok(vu[0]?.includes("call_count"))
})

test("erreur 190 sur la Page => reconnexion (classification partagee avec Instagram)", async () => {
  const g = fakeGraph([
    {
      match: "POST 1122334455/photos",
      status: 400,
      body: { error: { message: "token expired", code: 190 } },
    },
  ])
  await assert.rejects(
    () => createFacebookPublisher({ fetch: g.fetch, base: BASE }).createContainer(FRESH, ctx()),
    (e: unknown) => e instanceof NeedsReauthError
  )
})

test("un reel sans video => PERMANENT", async () => {
  const g = fakeGraph([])
  await assert.rejects(
    () =>
      createFacebookPublisher({ fetch: g.fetch, base: BASE }).createContainer(
        FRESH,
        ctx({ format: "reel" })
      ),
    (e: unknown) => e instanceof PermanentPublishError
  )
})
