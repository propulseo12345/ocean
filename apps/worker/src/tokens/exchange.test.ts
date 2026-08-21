import assert from "node:assert/strict"
import { test } from "node:test"
import type { FetchLike } from "../http"
import { createExchange, exchangeMeta, exchangeTikTok, readProviderCredentials } from "./exchange"
import type { RefreshState } from "./refresh"

// Phase ② du refresh : l'échange chez le fournisseur, contre un transport
// injecté. Aucun identifiant réel, aucun réseau.
//
// Les deux propriétés qui comptent le plus ici ne sont pas des chemins heureux :
//   - AUCUN TOKEN ne doit apparaître dans un message d'erreur (règle 12) ;
//   - TikTok répond 200 avec un champ `error` : le croire sur le code HTTP
//     écrirait un `access_token` undefined en base.

const CREDS = { clientId: "app-123", clientSecret: "secret-tres-confidentiel" }

function state(over: Partial<RefreshState> = {}): RefreshState {
  return {
    connectionId: "conn-1",
    provider: "tiktok",
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    refreshToken: "refresh-token-ABCDEFGH",
    accessToken: "access-token-12345678",
    canSelfRefresh: true,
    ...over,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

test("meta : re-echange fb_exchange_token, aucun refresh token emis", async () => {
  let calledUrl = ""
  const fetch: FetchLike = async (url) => {
    calledUrl = url
    return json({ access_token: "long-lived", token_type: "bearer", expires_in: 5_184_000 })
  }
  const out = await exchangeMeta(state({ provider: "facebook" }), CREDS, fetch)

  assert.ok(calledUrl.includes("grant_type=fb_exchange_token"))
  assert.ok(calledUrl.includes("fb_exchange_token=access-token-12345678"))
  assert.equal(out.accessToken, "long-lived")
  assert.equal(out.refreshToken, null, "Meta n'emet pas de refresh token")
  assert.ok(out.expiresAt && Date.parse(out.expiresAt) > Date.now())
})

test("meta : expires_in absent => echeance INCONNUE, pas une echeance inventee", async () => {
  const fetch: FetchLike = async () => json({ access_token: "long-lived" })
  const out = await exchangeMeta(state({ provider: "facebook" }), CREDS, fetch)
  // `null` fera « échéance inconnue » chez decideRefresh, donc aucun échange à
  // l'aveugle au prochain passage. Une date fabriquée déclencherait des échanges
  // inutiles — chez un fournisseur à rotation, ça casse le compte.
  assert.equal(out.expiresAt, null)
})

test("meta : sans access token courant, on ne tente rien", async () => {
  const fetch: FetchLike = async () => {
    throw new Error("ne doit pas etre appele")
  }
  await assert.rejects(
    () => exchangeMeta(state({ provider: "facebook", accessToken: null }), CREDS, fetch),
    /aucun access token courant/
  )
})

test("REGLE 12 : le corps d'erreur Meta est expurge de tout secret", async () => {
  // Meta renvoie régulièrement l'URL appelée dans son message d'erreur — donc
  // le token, en clair, qui partirait dans publish_jobs.last_error puis à
  // l'écran. C'est la fuite que redactSecrets ferme.
  const fetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        error: {
          message:
            "Invalid OAuth access token for url https://graph.facebook.com/oauth?fb_exchange_token=access-token-12345678&client_secret=secret-tres-confidentiel",
          code: 190,
        },
      }),
      { status: 400 }
    )

  await assert.rejects(
    () => exchangeMeta(state({ provider: "facebook" }), CREDS, fetch),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(!msg.includes("access-token-12345678"), `token en clair: ${msg}`)
      assert.ok(!msg.includes("secret-tres-confidentiel"), `secret client en clair: ${msg}`)
      assert.ok(msg.includes("«redacted»"))
      assert.ok(msg.includes("190"), "le code d'erreur reste lisible")
      return true
    }
  )
})

test("tiktok : rotation du refresh token, les deux echeances remontent", async () => {
  let body = ""
  const fetch: FetchLike = async (_url, init) => {
    body = String(init?.body)
    return json({
      access_token: "tt-access-2",
      refresh_token: "tt-refresh-2",
      expires_in: 86_400,
      refresh_expires_in: 31_536_000,
    })
  }
  const out = await exchangeTikTok(state(), CREDS, fetch)

  assert.ok(body.includes("grant_type=refresh_token"))
  assert.ok(body.includes("client_key=app-123"))
  assert.equal(out.accessToken, "tt-access-2")
  assert.equal(out.refreshToken, "tt-refresh-2")
  assert.ok(out.refreshTokenExpiresAt)
})

test("tiktok : pas de refresh token dans la reponse => on GARDE l'ancien", async () => {
  const fetch: FetchLike = async () => json({ access_token: "tt-access-2", expires_in: 86_400 })
  const out = await exchangeTikTok(state(), CREDS, fetch)
  // Écrire `null` effacerait le seul moyen de rafraîchir : le compte deviendrait
  // irrécupérable sans reconnexion humaine, silencieusement.
  assert.equal(out.refreshToken, "refresh-token-ABCDEFGH")
})

test("tiktok : HTTP 200 avec un champ error => c'est un ECHEC, pas un succes", async () => {
  const fetch: FetchLike = async () =>
    json({ error: "invalid_grant", error_description: "Refresh token is invalid or expired." })
  await assert.rejects(() => exchangeTikTok(state(), CREDS, fetch), /invalid_grant/)
})

test("REGLE 12 : le refresh token n'apparait pas dans l'erreur TikTok", async () => {
  const fetch: FetchLike = async () =>
    json({
      error: "invalid_grant",
      error_description: "refresh_token=refresh-token-ABCDEFGH is invalid",
    })
  await assert.rejects(
    () => exchangeTikTok(state(), CREDS, fetch),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(!msg.includes("refresh-token-ABCDEFGH"), msg)
      return true
    }
  )
})

test("identifiants absents => message qui NOMME les variables manquantes", () => {
  assert.throws(
    () => readProviderCredentials("facebook", {}),
    /OAUTH_META_CLIENT_ID \/ OAUTH_META_CLIENT_SECRET/
  )
  assert.throws(() => readProviderCredentials("google", {}), /aucun echange de token defini/)
})

test("aiguillage : chaque fournisseur social a son echange, les autres levent", async () => {
  const env = {
    OAUTH_META_CLIENT_ID: "m",
    OAUTH_META_CLIENT_SECRET: "ms-long-enough",
    OAUTH_TIKTOK_CLIENT_KEY: "t",
    OAUTH_TIKTOK_CLIENT_SECRET: "ts-long-enough",
  }
  const fetch: FetchLike = async () => json({ access_token: "ok" })
  const exchange = createExchange(fetch, env)

  assert.equal((await exchange(state({ provider: "facebook" }))).accessToken, "ok")
  assert.equal((await exchange(state({ provider: "tiktok" }))).accessToken, "ok")
  await assert.rejects(() => exchange(state({ provider: "google" })), /aucun echange/)
})
