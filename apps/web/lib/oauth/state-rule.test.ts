import assert from "node:assert/strict"
import test from "node:test"

import {
  constantTimeEquals,
  createNonce,
  type OAuthStatePayload,
  STATE_TTL_MS,
  signStateWith,
  verifyStateWith,
} from "./state-rule"

const SECRET = "secret-de-test-au-moins-32-octets-de-long"
const T0 = 1_760_000_000_000

const BASE = {
  provider: "meta",
  orgId: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  clientId: "33333333-3333-4333-8333-333333333333",
}

function émettre(overrides: Partial<typeof BASE> = {}, nowMs = T0, nonce = createNonce()) {
  return signStateWith({ ...BASE, ...overrides }, SECRET, { nonce, nowMs })
}

test("un state émis par nous est accepté, et rend exactement ce qu'on y a mis", () => {
  const nonce = createNonce()
  const token = émettre({}, T0, nonce)
  const v = verifyStateWith(token, SECRET, { nowMs: T0 + 1000, provider: "meta" })

  assert.equal(v.ok, true)
  if (!v.ok) return
  assert.equal(v.state.orgId, BASE.orgId)
  assert.equal(v.state.userId, BASE.userId)
  assert.equal(v.state.clientId, BASE.clientId)
  assert.equal(v.state.nonce, nonce)
  assert.equal(v.state.exp, T0 + STATE_TTL_MS)
})

test("LE TICKET : aucun state émis ne contient de vérifieur PKCE", () => {
  // PKCE sépare le code (qui voyage dans l'URL) du vérifieur (qui ne doit PAS y
  // voyager). L'ancienne version mettait le vérifieur dans le state, donc dans
  // la même URL que le code : PKCE était câblé et sans effet. Cette propriété
  // interdit la régression, y compris si quelqu'un rajoute le champ « juste
  // pour dépanner » — le champ ressortirait ici en clair.
  const token = émettre()
  const body = token.slice(0, token.lastIndexOf("."))
  const décodé = Buffer.from(body, "base64url").toString("utf8")

  assert.ok(!/verifier/i.test(décodé), `le state transporte un vérifieur : ${décodé}`)
  const objet = JSON.parse(décodé) as Record<string, unknown>
  assert.deepEqual(
    Object.keys(objet).sort(),
    ["clientId", "exp", "nonce", "orgId", "provider", "userId"],
    "la forme du state a changé — vérifier qu'aucun secret n'y est entré"
  )
})

test("le payload est LISIBLE par n'importe qui : rien de secret ne doit y vivre", () => {
  // base64url n'est pas du chiffrement. Ce test fige l'intention : le state est
  // signé (intègre), pas confidentiel.
  const token = émettre()
  const décodé = JSON.parse(
    Buffer.from(token.slice(0, token.lastIndexOf(".")), "base64url").toString("utf8")
  ) as OAuthStatePayload
  assert.equal(décodé.orgId, BASE.orgId)
})

test("un state expiré est refusé, et la borne est franche", () => {
  const token = émettre({}, T0)
  // Une milliseconde avant l'échéance : encore bon.
  assert.equal(
    verifyStateWith(token, SECRET, { nowMs: T0 + STATE_TTL_MS - 1, provider: "meta" }).ok,
    true
  )
  // À l'échéance pile : refusé.
  const juste = verifyStateWith(token, SECRET, { nowMs: T0 + STATE_TTL_MS, provider: "meta" })
  assert.equal(juste.ok, false)
  if (!juste.ok) assert.equal(juste.reason, "expire")
})

test("PROPRIÉTÉ : aucune altération d'un seul caractère du payload ne passe", () => {
  const token = émettre()
  const dot = token.lastIndexOf(".")
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  let acceptés = 0
  let essais = 0
  // Balayage sur tout le corps ET tout le MAC : une garde qui ne testerait que
  // la signature laisserait passer un payload réécrit avec son propre MAC.
  for (const [chaîne, estCorps] of [
    [body, true],
    [mac, false],
  ] as const) {
    for (let i = 0; i < chaîne.length; i++) {
      const remplacant = chaîne[i] === "A" ? "B" : "A"
      const muté = chaîne.slice(0, i) + remplacant + chaîne.slice(i + 1)
      const candidat = estCorps ? `${muté}.${mac}` : `${body}.${muté}`
      essais++
      if (verifyStateWith(candidat, SECRET, { nowMs: T0 + 1000, provider: "meta" }).ok) acceptés++
    }
  }

  assert.ok(essais > 100, `corpus trop maigre (${essais}) — la propriété ne prouverait rien`)
  assert.equal(acceptés, 0, `${acceptés} altérations acceptées sur ${essais}`)
})

test("un state signé avec un AUTRE secret est refusé", () => {
  const token = signStateWith(BASE, "un-autre-secret-tout-aussi-long-que-l-autre", {
    nonce: createNonce(),
    nowMs: T0,
  })
  const v = verifyStateWith(token, SECRET, { nowMs: T0 + 1000, provider: "meta" })
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.reason, "signature")
})

test("un state émis pour un provider ne vaut pas pour un autre", () => {
  const token = émettre({ provider: "meta" })
  const v = verifyStateWith(token, SECRET, { nowMs: T0 + 1000, provider: "tiktok" })
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.reason, "provider")
})

test("un payload signé mais MALFORMÉ est refusé (org vide, exp absente…)", () => {
  // On forge nous-mêmes des payloads valides au sens de la signature : c'est le
  // cas qu'une vérification limitée au HMAC laisserait passer, avec un `orgId`
  // `undefined` qui filerait jusqu'à une requête SQL.
  const { createHmac } = require("node:crypto") as typeof import("node:crypto")
  const forger = (objet: unknown) => {
    const body = Buffer.from(JSON.stringify(objet)).toString("base64url")
    const mac = createHmac("sha256", SECRET).update(body).digest("base64url")
    return `${body}.${mac}`
  }

  for (const mauvais of [
    { ...BASE, nonce: "n", exp: T0 + 1000, orgId: "" },
    { ...BASE, nonce: "n", exp: T0 + 1000, userId: "" },
    { ...BASE, nonce: "", exp: T0 + 1000 },
    { ...BASE, nonce: "n" },
    { ...BASE, nonce: "n", exp: "bientot" },
    { ...BASE, nonce: "n", exp: T0 + 1000, clientId: 42 },
    "pas un objet",
    null,
  ]) {
    const v = verifyStateWith(forger(mauvais), SECRET, { nowMs: T0, provider: "meta" })
    assert.equal(v.ok, false, `accepté à tort : ${JSON.stringify(mauvais)}`)
  }
})

test("un jeton sans point, ou vide, ne fait pas exploser la vérification", () => {
  for (const brut of ["", "sanspoint", ".", "a.", ".b"]) {
    assert.equal(verifyStateWith(brut, SECRET, { nowMs: T0, provider: "meta" }).ok, false)
  }
})

test("constantTimeEquals : égalité stricte, longueurs différentes refusées", () => {
  const n = createNonce()
  assert.equal(constantTimeEquals(n, n), true)
  assert.equal(constantTimeEquals(n, `${n}x`), false)
  assert.equal(constantTimeEquals(n, ""), false)
  assert.equal(constantTimeEquals("", ""), true)
})

test("deux nonces ne se ressemblent pas, et ils sont assez longs pour ne pas se deviner", () => {
  const vus = new Set<string>()
  for (let i = 0; i < 500; i++) vus.add(createNonce())
  assert.equal(vus.size, 500)
  // 32 octets → 43 caractères en base64url.
  assert.ok(createNonce().length >= 43)
})
