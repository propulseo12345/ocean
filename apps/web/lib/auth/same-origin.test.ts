import assert from "node:assert/strict"
import { test } from "node:test"

import { type OriginHeaders, verifierOrigine } from "./same-origin"

// Ticket V-3 — CSRF sur l'acceptation d'invitation.
//
// Le test porte sur la fonction de DÉCISION, pure et donc atteignable. Le
// câblage (lecture des en-têtes réels) est vérifié séparément dans le test du
// Route Handler — la leçon de la salve précédente étant qu'une décision correcte
// ne prouve rien sur la route, et que l'attaquant n'atteint que la route.

const NOUS = "https://socean.54-36-180-115.sslip.io"

function entetes(p: Partial<OriginHeaders>): OriginHeaders {
  return { origin: null, secFetchSite: null, ...p }
}

test("une soumission depuis nos propres pages passe", () => {
  assert.deepEqual(verifierOrigine(entetes({ origin: NOUS, secFetchSite: "same-origin" }), NOUS), {
    ok: true,
  })
  // Navigateur sans Fetch Metadata : `Origin` seul suffit.
  assert.deepEqual(verifierOrigine(entetes({ origin: NOUS }), NOUS), { ok: true })
  // `Origin` masqué par un proxy mais Fetch Metadata présent.
  assert.deepEqual(verifierOrigine(entetes({ secFetchSite: "same-origin" }), NOUS), { ok: true })
})

test("PROPRIETE : aucune combinaison cross-site n est acceptee", () => {
  // Le scénario réel : une page de l'attaquant soumet vers nous. Le navigateur
  // pose alors `Sec-Fetch-Site: cross-site` et un `Origin` étranger — et
  // l'attaquant ne peut falsifier ni l'un ni l'autre depuis une page web.
  const ORIGINES_TIERCES = [
    "https://evil.tld",
    "http://evil.tld",
    "null",
    "https://socean.54-36-180-115.sslip.io.evil.tld", // le piège du startsWith
    "https://socean.54-36-180-115.sslip.io:8443", // port different
    "http://socean.54-36-180-115.sslip.io", // schema different
    "https://evil.socean.54-36-180-115.sslip.io", // sous-domaine
  ]
  const SITES = ["cross-site", "same-site", "none", "CROSS-SITE", ""]

  for (const origin of [...ORIGINES_TIERCES, null, NOUS]) {
    for (const secFetchSite of SITES) {
      const v = verifierOrigine(entetes({ origin, secFetchSite }), NOUS)
      assert.equal(
        v.ok,
        false,
        `doit etre refuse : origin=${origin} sec-fetch-site=${secFetchSite}`
      )
    }
  }

  // Et sans Fetch Metadata, une origine tierce reste refusée.
  for (const origin of ORIGINES_TIERCES) {
    assert.equal(verifierOrigine(entetes({ origin }), NOUS).ok, false, `origin=${origin}`)
  }
})

test("aucune preuve du tout => refus (fail-closed)", () => {
  // Une allowlist qui laisse passer l'inconnu est exactement ce qui a produit
  // les defauts de ce depot. Ici l'absence de preuve est un refus.
  assert.deepEqual(verifierOrigine(entetes({}), NOUS), { ok: false, raison: "no_proof" })
})

test("un Origin illisible est refuse, pas ignore", () => {
  for (const origin of ["pas-une-url", "://", " ", "https://"]) {
    const v = verifierOrigine(entetes({ origin }), NOUS)
    assert.equal(v.ok, false, origin)
  }
})

test("la raison du refus distingue les cas, pour les logs", () => {
  assert.deepEqual(verifierOrigine(entetes({ secFetchSite: "cross-site" }), NOUS), {
    ok: false,
    raison: "cross_site",
  })
  assert.deepEqual(verifierOrigine(entetes({ origin: "https://evil.tld" }), NOUS), {
    ok: false,
    raison: "origin_mismatch",
  })
  assert.deepEqual(verifierOrigine(entetes({}), NOUS), { ok: false, raison: "no_proof" })
})
