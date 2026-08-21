import assert from "node:assert/strict"
import test from "node:test"

import { type CallbackInput, decideCallback } from "./callback-rule"
import { createNonce, STATE_TTL_MS, signStateWith } from "./state-rule"

const SECRET = "secret-de-test-au-moins-32-octets-de-long"
const T0 = 1_760_000_000_000
const ORG = "22222222-2222-4222-8222-222222222222"
const MOI = "11111111-1111-4111-8111-111111111111"
const AUTRE = "99999999-9999-4999-8999-999999999999"

function flux(overrides: Partial<CallbackInput> = {}, nonce = createNonce()): CallbackInput {
  const stateToken = signStateWith(
    { provider: "meta", orgId: ORG, userId: MOI, clientId: "33333333-3333-4333-8333-333333333333" },
    SECRET,
    { nonce, nowMs: T0 }
  )
  return {
    provider: "meta",
    code: "code-autorisation",
    providerError: null,
    stateToken,
    transaction: { nonce, codeVerifier: "verifieur-pkce" },
    sessionUserId: MOI,
    secret: SECRET,
    nowMs: T0 + 1000,
    ...overrides,
  }
}

test("le flux nominal passe, et le vérifieur PKCE vient du COOKIE", () => {
  const d = decideCallback(flux())
  assert.equal(d.ok, true)
  if (!d.ok) return
  assert.equal(d.state.orgId, ORG)
  assert.equal(d.state.userId, MOI)
  assert.equal(d.codeVerifier, "verifieur-pkce")
})

test("GARDE ② — un state valide SANS cookie est refusé (rejeu d'un state capté)", () => {
  // C'est le scénario réel : le state voyage dans l'URL de redirection, donc
  // dans l'historique, le Referer et les journaux du fournisseur. Le rejouer
  // depuis un autre navigateur ne doit rien donner.
  const d = decideCallback(flux({ transaction: null }))
  assert.equal(d.ok, false)
  if (!d.ok) assert.equal(d.error, "state")
})

test("GARDE ② — un cookie dont le nonce ne correspond pas est refusé (cookie forcé)", () => {
  // Un attaquant capable de poser un cookie chez la victime (sous-domaine) ne
  // peut pas fabriquer le state signé assorti : les deux moitiés doivent
  // correspondre, aucune ne suffit.
  const d = decideCallback(flux({ transaction: { nonce: createNonce() } }))
  assert.equal(d.ok, false)
  if (!d.ok) assert.equal(d.error, "state")
})

test("GARDE ③ — la session d'un AUTRE utilisateur est refusée", () => {
  // Sans cette garde, le `userId` du state serait cru sur parole : la connexion
  // sociale et ses tokens atterriraient dans l'org de quelqu'un d'autre.
  const d = decideCallback(flux({ sessionUserId: AUTRE }))
  assert.equal(d.ok, false)
  if (!d.ok) assert.equal(d.error, "state")
})

test("GARDE ③ — l'absence de session est refusée", () => {
  const d = decideCallback(flux({ sessionUserId: null }))
  assert.equal(d.ok, false)
})

test("GARDE ① — un state expiré est refusé, même avec le bon cookie et la bonne session", () => {
  const d = decideCallback(flux({ nowMs: T0 + STATE_TTL_MS + 1 }))
  assert.equal(d.ok, false)
  if (!d.ok) assert.equal(d.error, "state")
})

test("GARDE ① — un state émis pour Meta ne vaut pas sur le callback TikTok", () => {
  const d = decideCallback(flux({ provider: "tiktok" }))
  assert.equal(d.ok, false)
  if (!d.ok) assert.equal(d.error, "state")
})

test("GARDE ① — un state signé avec un autre secret est refusé", () => {
  const nonce = createNonce()
  const étranger = signStateWith(
    { provider: "meta", orgId: ORG, userId: MOI },
    "autre-secret-long",
    {
      nonce,
      nowMs: T0,
    }
  )
  const d = decideCallback(flux({ stateToken: étranger, transaction: { nonce } }))
  assert.equal(d.ok, false)
})

test("le refus de l'utilisateur chez le fournisseur est distingué d'un flux cassé", () => {
  const refus = decideCallback(flux({ providerError: "access_denied" }))
  assert.equal(refus.ok, false)
  if (!refus.ok) assert.equal(refus.error, "denied")

  const vide = decideCallback(flux({ code: null }))
  assert.equal(vide.ok, false)
  if (!vide.ok) assert.equal(vide.error, "missing")
})

test("PROPRIÉTÉ : aucune combinaison dégradée n'aboutit — seul le flux complet passe", () => {
  // Les 4 dimensions qui doivent TOUTES être bonnes. Une énumération de cas
  // n'aurait couvert que ceux auxquels on a pensé ; ici on balaie le produit.
  const nonce = createNonce()
  const bonState = flux({}, nonce).stateToken

  const états = [
    { nom: "state bon", stateToken: bonState },
    { nom: "state absent", stateToken: null },
    { nom: "state altéré", stateToken: `${bonState}x` },
  ]
  const cookies = [
    { nom: "cookie bon", transaction: { nonce, codeVerifier: "v" } },
    { nom: "cookie absent", transaction: null },
    { nom: "cookie étranger", transaction: { nonce: createNonce() } },
  ]
  const sessions = [
    { nom: "session bonne", sessionUserId: MOI },
    { nom: "pas de session", sessionUserId: null },
    { nom: "session étrangère", sessionUserId: AUTRE },
  ]
  const horloges = [
    { nom: "à l'heure", nowMs: T0 + 1000 },
    { nom: "périmé", nowMs: T0 + STATE_TTL_MS + 1 },
  ]

  let acceptés = 0
  let essais = 0
  for (const s of états) {
    for (const c of cookies) {
      for (const u of sessions) {
        for (const h of horloges) {
          essais++
          const d = decideCallback({
            ...flux({}, nonce),
            stateToken: s.stateToken,
            transaction: c.transaction,
            sessionUserId: u.sessionUserId,
            nowMs: h.nowMs,
          })
          const toutBon =
            s.nom === "state bon" &&
            c.nom === "cookie bon" &&
            u.nom === "session bonne" &&
            h.nom === "à l'heure"
          if (d.ok) {
            acceptés++
            assert.ok(toutBon, `accepté à tort : ${s.nom} / ${c.nom} / ${u.nom} / ${h.nom}`)
          } else {
            assert.ok(!toutBon, `refusé à tort : ${s.nom} / ${c.nom} / ${u.nom} / ${h.nom}`)
          }
        }
      }
    }
  }

  assert.equal(essais, 54)
  // Une seule combinaison sur 54 aboutit : celle où les quatre sont bonnes.
  assert.equal(acceptés, 1)
})
