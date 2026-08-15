import assert from "node:assert/strict"
import { test } from "node:test"
import { NeedsReauthError, PermanentPublishError } from "../../domain"
import type { FetchLike } from "../../http"
import { graphCall, graphRequest, MetaApiError, toPublishError } from "./graph"

// La classification des erreurs Meta — le cœur de la règle 18 côté plateforme.
// Se tromper coûte dans les deux sens : retenter un token révoqué brûle cinq
// tentatives pour rien ; déclarer permanent un rate limit pose `failed` sur un
// contenu que rien n'empêchait de publier.

const BASE = "https://graph.test/v21.0"

function metaError(code: number, subcode?: number, status = 400): MetaApiError {
  return new MetaApiError(status, code, subcode ?? null, "trace", "message")
}

test("code 190 (token invalide/revoque) => RECONNEXION, jamais un retry", () => {
  const out = toPublishError(metaError(190, 463))
  assert.ok(out instanceof NeedsReauthError)
})

test("code 102 (session invalide) => reconnexion aussi", () => {
  assert.ok(toPublishError(metaError(102)) instanceof NeedsReauthError)
})

test("code 4 / 17 / 32 / 613 (rate limits) => TRANSITOIRE, on retente", () => {
  for (const code of [4, 17, 32, 613]) {
    const out = toPublishError(metaError(code))
    assert.ok(
      !(out instanceof PermanentPublishError),
      `code ${code} doit rester retryable : c'est une limite de debit, pas un refus`
    )
  }
})

test("code 1 / 2 / 341 (pannes Meta) => TRANSITOIRE", () => {
  for (const code of [1, 2, 341]) {
    assert.ok(!(toPublishError(metaError(code)) instanceof PermanentPublishError))
  }
})

test("code 10 / 200 (permission) et 100 (parametre) => PERMANENT", () => {
  for (const code of [10, 100, 200]) {
    const out = toPublishError(metaError(code))
    assert.ok(out instanceof PermanentPublishError, `code ${code}`)
    assert.ok(!(out instanceof NeedsReauthError), "une permission manquante n'est pas un token mort")
  }
})

test("368 (bloque pour violation) est classe PERMANENT malgre son libelle", () => {
  // « Temporairement bloqué » : c'est justement le fait de réessayer qui crée et
  // aggrave ce blocage. Un humain doit regarder.
  assert.ok(toPublishError(metaError(368)) instanceof PermanentPublishError)
})

test("sous-codes IG d'upload : rejet de media = PERMANENT, echec de telechargement = retry", () => {
  // 2207026 : format vidéo non pris en charge. Aucune tentative ne le changera.
  assert.ok(toPublishError(metaError(100, 2207026)) instanceof PermanentPublishError)
  // 2207003 : Meta n'a pas réussi à récupérer le média. Souvent son réseau — et
  // notre URL signée est valide 48 h, donc la tentative suivante a une chance.
  assert.ok(!(toPublishError(metaError(100, 2207003)) instanceof PermanentPublishError))
})

test("code INCONNU => transitoire par defaut (on ne condamne pas sur une supposition)", () => {
  const out = toPublishError(metaError(987654))
  assert.ok(!(out instanceof PermanentPublishError))
  assert.ok(!(out instanceof NeedsReauthError))
})

test("500 sans code exploitable => transitoire", () => {
  assert.ok(!(toPublishError(new MetaApiError(500, null, null, null, "boom")) instanceof
    PermanentPublishError))
})

// --- le transport lui-meme --------------------------------------------------

test("le token part en EN-TETE, jamais dans l'URL", async () => {
  let seenUrl = ""
  let seenAuth: string | null = null
  const fetch: FetchLike = async (url, init) => {
    seenUrl = url
    seenAuth = new Headers(init?.headers).get("authorization")
    return new Response(JSON.stringify({ id: "42" }), { status: 200 })
  }
  await graphRequest<{ id: string }>(
    fetch,
    { method: "GET", path: "me", params: { fields: "id" }, accessToken: "EAAG-secret-token" },
    BASE
  )
  // Meta recopie volontiers l'URL appelée dans ses messages d'erreur : un token
  // en query string finit dans publish_jobs.last_error, donc à l'écran.
  assert.ok(!seenUrl.includes("EAAG-secret-token"), seenUrl)
  assert.equal(seenAuth, "Bearer EAAG-secret-token")
})

test("REGLE 12 : un token recopie par Meta dans son erreur est expurge", async () => {
  const fetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: "Invalid OAuth access token EAAG-secret-token for /me",
          code: 190,
          error_subcode: 463,
        },
      }),
      { status: 400 }
    )
  await assert.rejects(
    () =>
      graphCall(fetch, { method: "GET", path: "me", accessToken: "EAAG-secret-token" }, BASE),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(!msg.includes("EAAG-secret-token"), `token en clair : ${msg}`)
      assert.ok(err instanceof NeedsReauthError, "et l'erreur reste correctement classee")
      return true
    }
  )
})

test("HTTP 200 avec un objet error => c'est un ECHEC, pas un succes", async () => {
  // Sans ce test, `data.id` serait `undefined` et partirait en base comme
  // identifiant de publication.
  const fetch: FetchLike = async () =>
    new Response(JSON.stringify({ error: { message: "nope", code: 4 } }), { status: 200 })
  await assert.rejects(
    () => graphCall(fetch, { method: "POST", path: "x/media", accessToken: "t" }, BASE),
    (err: unknown) => err instanceof MetaApiError && err.code === 4
  )
})

test("POST : les parametres partent en formulaire, GET : en query string", async () => {
  const seen: { url: string; body?: string }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, body: init?.body ? String(init.body) : undefined })
    return new Response(JSON.stringify({ id: "1" }), { status: 200 })
  }
  await graphRequest(
    fetch,
    { method: "POST", path: "17841/media", params: { caption: "salut" }, accessToken: "t" },
    BASE
  )
  await graphRequest(
    fetch,
    { method: "GET", path: "17841", params: { fields: "status_code" }, accessToken: "t" },
    BASE
  )
  assert.equal(seen[0]?.url, `${BASE}/17841/media`)
  assert.ok(seen[0]?.body?.includes("caption=salut"))
  assert.equal(seen[1]?.url, `${BASE}/17841?fields=status_code`)
})

test("les parametres undefined ne sont pas envoyes (une legende vide n'est pas une legende)", async () => {
  let body = ""
  const fetch: FetchLike = async (_url, init) => {
    body = String(init?.body)
    return new Response(JSON.stringify({ id: "1" }), { status: 200 })
  }
  await graphRequest(
    fetch,
    {
      method: "POST",
      path: "x/media",
      params: { image_url: "https://x/y.jpg", caption: undefined },
      accessToken: "t",
    },
    BASE
  )
  assert.ok(!body.includes("caption"), body)
})

test("le signal d'annulation est transmis a fetch (sinon la requete survit au timeout)", async () => {
  let seen: AbortSignal | null | undefined
  const fetch: FetchLike = async (_url, init) => {
    seen = init?.signal
    return new Response(JSON.stringify({ id: "1" }), { status: 200 })
  }
  const controller = new AbortController()
  await graphRequest(
    fetch,
    { method: "GET", path: "me", accessToken: "t", signal: controller.signal },
    BASE
  )
  assert.equal(seen, controller.signal)
})
