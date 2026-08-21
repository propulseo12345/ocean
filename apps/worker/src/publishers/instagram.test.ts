import assert from "node:assert/strict"
import { test } from "node:test"
import { NeedsReauthError, PermanentPublishError, type PublishJob } from "../domain"
import type { FetchLike } from "../http"
import type { JobMedia } from "../media/signed-urls"
import { createInstagramPublisher, mapStatusCode } from "./instagram"
import type { PublishContext } from "./types"

// Instagram réel, rejoué contre un FAUX Graph API qui répond les formes
// documentées — y compris les formes d'ERREUR. Aucun octet ne part chez Meta :
// c'est la limite assumée de ce lot, et c'est aussi ce qui rend le dialogue
// vérifiable dès aujourd'hui.

const BASE = "https://graph.test/v21.0"
const JOB = { id: "job-1", contentTargetId: "target-1" } as PublishJob

function media(over: Partial<JobMedia> = {}): JobMedia {
  return {
    mediaAssetId: "asset-1",
    kind: "image",
    url: "https://projet.supabase.co/storage/v1/object/sign/media-originals/a.jpg?token=jwt",
    mimeType: "image/jpeg",
    width: 1080,
    height: 1350,
    durationMs: null,
    byteSize: 1000,
    altText: null,
    ...over,
  }
}

function ctx(over: Partial<PublishContext> = {}): PublishContext {
  return {
    accessToken: "PAGE-TOKEN",
    providerAccountId: "17841400000",
    media: [media()],
    caption: "Bonjour\n\n#seo",
    format: "post",
    ...over,
  }
}

/** Faux Graph : une table chemin+methode -> reponse, et le journal des appels. */
function fakeGraph(routes: { match: string; body: unknown; status?: number }[]) {
  const calls: { method: string; url: string; body: string | undefined }[] = []
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET"
    const body = init?.body ? String(init.body) : undefined
    calls.push({ method, url, body })
    const path = url.slice(BASE.length + 1)
    for (const r of routes) {
      if (`${method} ${path}`.includes(r.match)) {
        return new Response(JSON.stringify(r.body), { status: r.status ?? 200 })
      }
    }
    return new Response(
      JSON.stringify({ error: { message: `route inconnue: ${method} ${path}` } }),
      {
        status: 404,
      }
    )
  }
  return { fetch, calls }
}

function publisher(fetch: FetchLike) {
  return createInstagramPublisher({ fetch, base: BASE })
}

// --- mapStatusCode ----------------------------------------------------------

test("FINISHED n'est pas PUBLISHED : toute la regle 15 tient sur cette distinction", () => {
  assert.equal(mapStatusCode("FINISHED"), "ready", "pret a publier => rien n'est en ligne")
  assert.equal(mapStatusCode("PUBLISHED"), "published", "deja publie => NE PAS republier")
  assert.equal(mapStatusCode("IN_PROGRESS"), "in_progress")
  assert.equal(mapStatusCode("ERROR"), "error")
  assert.equal(mapStatusCode("EXPIRED"), "expired")
})

test("un status_code inconnu n'est JAMAIS lu comme 'pret'", () => {
  // Publier est le seul geste irréversible du module : sur une valeur qu'on ne
  // comprend pas, on attend, on ne parie pas.
  assert.equal(mapStatusCode(undefined), "in_progress")
  assert.equal(mapStatusCode("SOMETHING_NEW"), "in_progress")
})

// --- image simple -----------------------------------------------------------

test("image simple : POST /{ig-user}/media avec image_url et caption", async () => {
  const g = fakeGraph([{ match: "POST 17841400000/media", body: { id: "container-1" } }])
  const out = await publisher(g.fetch).createContainer(JOB, ctx())

  assert.equal(out.containerId, "container-1")
  const sent = new URLSearchParams(g.calls[0]?.body ?? "")
  assert.ok(sent.get("image_url")?.includes("media-originals"))
  assert.equal(sent.get("caption"), "Bonjour\n\n#seo")
  assert.equal(sent.get("media_type"), null, "une image simple n'a pas de media_type")
})

test("alt_text : pose sur une image, JAMAIS sur un reel", async () => {
  const g = fakeGraph([{ match: "POST 17841400000/media", body: { id: "c" } }])
  const pub = publisher(g.fetch)

  await pub.createContainer(JOB, ctx({ media: [media({ altText: "Un chat" })] }))
  assert.equal(new URLSearchParams(g.calls[0]?.body ?? "").get("alt_text"), "Un chat")

  await pub.createContainer(
    JOB,
    ctx({ format: "reel", media: [media({ kind: "video", altText: "Un chat" })] })
  )
  // Sur un conteneur REELS, `alt_text` fait echouer la creation (code 100).
  assert.equal(new URLSearchParams(g.calls[1]?.body ?? "").get("alt_text"), null)
})

test("reel : media_type=REELS et video_url", async () => {
  const g = fakeGraph([{ match: "POST 17841400000/media", body: { id: "c" } }])
  await publisher(g.fetch).createContainer(
    JOB,
    ctx({ format: "reel", media: [media({ kind: "video" })] })
  )
  const sent = new URLSearchParams(g.calls[0]?.body ?? "")
  assert.equal(sent.get("media_type"), "REELS")
  assert.ok(sent.get("video_url"))
  assert.equal(sent.get("image_url"), null)
})

// --- carrousel --------------------------------------------------------------

test("carrousel : N enfants is_carousel_item, PUIS un parent qui les liste dans l'ordre", async () => {
  let n = 0
  const g = fakeGraph([
    {
      match: "POST 17841400000/media",
      get body() {
        n += 1
        return { id: `c${n}` }
      },
    },
  ])
  const out = await publisher(g.fetch).createContainer(
    JOB,
    ctx({
      format: "carousel",
      media: [
        media({ mediaAssetId: "a", url: "https://x/0.jpg?token=t" }),
        media({ mediaAssetId: "b", url: "https://x/1.jpg?token=t" }),
      ],
    })
  )

  assert.equal(g.calls.length, 3, "2 enfants + 1 parent")
  const enfant0 = new URLSearchParams(g.calls[0]?.body ?? "")
  assert.equal(enfant0.get("is_carousel_item"), "true")
  assert.equal(enfant0.get("caption"), null, "la legende est sur le PARENT, pas sur les slides")

  const parent = new URLSearchParams(g.calls[2]?.body ?? "")
  assert.equal(parent.get("media_type"), "CAROUSEL")
  assert.equal(parent.get("children"), "c1,c2", "l'ordre du carrousel est celui de content_media")
  assert.equal(parent.get("caption"), "Bonjour\n\n#seo")
  assert.equal(out.containerId, "c3")
})

test("un carrousel de 1 ou de 11 est refuse ICI, pas par un code 100 trois secondes plus tard", async () => {
  const g = fakeGraph([{ match: "POST", body: { id: "c" } }])
  const pub = publisher(g.fetch)
  await assert.rejects(
    () => pub.createContainer(JOB, ctx({ format: "carousel", media: [media()] })),
    (e: unknown) => e instanceof PermanentPublishError
  )
  await assert.rejects(
    () =>
      pub.createContainer(
        JOB,
        ctx({ format: "carousel", media: Array.from({ length: 11 }, () => media()) })
      ),
    (e: unknown) => e instanceof PermanentPublishError
  )
  assert.equal(g.calls.length, 0, "et aucun appel n'a ete emis")
})

test("aucun media => PERMANENT (Instagram refuse un post sans media)", async () => {
  const g = fakeGraph([])
  await assert.rejects(
    () => publisher(g.fetch).createContainer(JOB, ctx({ media: [] })),
    (e: unknown) => e instanceof PermanentPublishError
  )
})

test("un reel sans video => PERMANENT", async () => {
  const g = fakeGraph([])
  await assert.rejects(
    () => publisher(g.fetch).createContainer(JOB, ctx({ format: "reel" })),
    (e: unknown) => e instanceof PermanentPublishError
  )
})

// --- publication ------------------------------------------------------------

test("publish : POST media_publish avec creation_id, puis permalien", async () => {
  const g = fakeGraph([
    { match: "POST 17841400000/media_publish", body: { id: "media-99" } },
    { match: "GET media-99", body: { permalink: "https://instagram.com/p/abc" } },
  ])
  const res = await publisher(g.fetch).publish(JOB, "container-1", ctx())

  assert.equal(new URLSearchParams(g.calls[0]?.body ?? "").get("creation_id"), "container-1")
  assert.equal(res.externalPostId, "media-99")
  assert.equal(res.permalink, "https://instagram.com/p/abc")
  assert.equal(res.targetStatus, "published")
})

test("permalien introuvable : le post EST en ligne, on ne fait pas echouer le job", async () => {
  // Echouer ici renverrait le job en retry sur une publication reussie : le
  // doublon exact que la regle 15 existe pour eviter. Le permalien est du
  // confort, l'id est la verite.
  const g = fakeGraph([
    { match: "POST 17841400000/media_publish", body: { id: "media-99" } },
    { match: "GET media-99", body: { error: { message: "nope", code: 100 } }, status: 400 },
  ])
  const res = await publisher(g.fetch).publish(JOB, "container-1", ctx())
  assert.equal(res.externalPostId, "media-99")
  assert.equal(res.permalink, undefined)
})

test("getContainerStatus lit status_code (regle 15, chemin de reprise)", async () => {
  const g = fakeGraph([{ match: "GET container-1", body: { status_code: "PUBLISHED" } }])
  const status = await publisher(g.fetch).getContainerStatus(JOB, "container-1", ctx())
  assert.equal(status, "published")
  assert.ok(g.calls[0]?.url.includes("fields=status_code"))
})

test("resolvePublished rend l'id du media et son permalien", async () => {
  const g = fakeGraph([
    { match: "GET container-1", body: { id: "media-99", permalink: "https://instagram.com/p/x" } },
  ])
  const res = await publisher(g.fetch).resolvePublished(JOB, "container-1", ctx())
  assert.equal(res.externalPostId, "media-99")
  assert.equal(res.permalink, "https://instagram.com/p/x")
})

// --- erreurs Meta, formes reelles -------------------------------------------

test("{'error':{'code':190}} => NeedsReauth (permanent, aucun retry)", async () => {
  const g = fakeGraph([
    {
      match: "POST 17841400000/media",
      status: 400,
      body: {
        error: {
          message: "Error validating access token: Session has expired",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "A1",
        },
      },
    },
  ])
  await assert.rejects(
    () => publisher(g.fetch).createContainer(JOB, ctx()),
    (e: unknown) => e instanceof NeedsReauthError
  )
})

test("{'error':{'code':4}} (rate limit) => retryable, surtout pas failed", async () => {
  const g = fakeGraph([
    {
      match: "POST 17841400000/media_publish",
      status: 400,
      body: {
        error: {
          message: "(#4) Application request limit reached",
          type: "OAuthException",
          code: 4,
          fbtrace_id: "A2",
        },
      },
    },
  ])
  await assert.rejects(
    () => publisher(g.fetch).publish(JOB, "container-1", ctx()),
    (e: unknown) => e instanceof Error && !(e instanceof PermanentPublishError)
  )
})

test("media rejete (sous-code 2207026) => PERMANENT, failed direct", async () => {
  const g = fakeGraph([
    {
      match: "POST 17841400000/media",
      status: 400,
      body: {
        error: {
          message: "The video format is not supported",
          code: 100,
          error_subcode: 2207026,
        },
      },
    },
  ])
  await assert.rejects(
    () =>
      publisher(g.fetch).createContainer(
        JOB,
        ctx({ format: "reel", media: [media({ kind: "video" })] })
      ),
    (e: unknown) => e instanceof PermanentPublishError && !(e instanceof NeedsReauthError)
  )
})

test("ctx.signal est transmis a CHAQUE appel (sinon la requete survit au timeout)", async () => {
  const signals: (AbortSignal | null | undefined)[] = []
  const fetch: FetchLike = async (_url, init) => {
    signals.push(init?.signal)
    return new Response(JSON.stringify({ id: "x" }), { status: 200 })
  }
  const controller = new AbortController()
  const c = ctx({ signal: controller.signal, format: "carousel", media: [media(), media()] })
  await createInstagramPublisher({ fetch, base: BASE }).createContainer(JOB, c)

  assert.equal(signals.length, 3, "2 enfants + 1 parent")
  assert.ok(
    signals.every((s) => s === controller.signal),
    "un seul appel sans signal suffit a laisser vivre une requete apres le timeout du moteur"
  )
})

test("REGLE 12 : l'URL signee du media n'apparait dans aucun message d'erreur", async () => {
  const g = fakeGraph([
    {
      match: "POST 17841400000/media",
      status: 400,
      body: {
        error: {
          message: "Invalid parameter",
          code: 100,
        },
      },
    },
  ])
  await assert.rejects(
    () => publisher(g.fetch).createContainer(JOB, ctx()),
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      assert.ok(!msg.includes("token=jwt"), `jeton d'URL signee dans l'erreur : ${msg}`)
      return true
    }
  )
})
