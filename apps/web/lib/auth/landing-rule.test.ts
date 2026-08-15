import assert from "node:assert/strict"
import { test } from "node:test"

import { landingFor } from "./landing-rule"

// Ticket P7-5 — un point unique de résolution de rôle après authentification.
// Avant : `/dashboard` en dur à quatre endroits, dont le proxy, qui effaçait
// `next` au passage. Un Reviewer y était envoyé systématiquement, puis rebondi
// vers `/onboarding` par `getActiveOrg` — une route qui n'existait pas (P7-3).

test("membre d une organisation => le poste de travail agence", () => {
  assert.equal(landingFor({ orgMemberships: 1, clientMemberships: 0 }), "/dashboard")
  assert.equal(landingFor({ orgMemberships: 3, clientMemberships: 0 }), "/dashboard")
})

test("reviewer sans organisation => le portail, jamais le dashboard", () => {
  assert.equal(landingFor({ orgMemberships: 0, clientMemberships: 1 }), "/portal")
  assert.equal(landingFor({ orgMemberships: 0, clientMemberships: 4 }), "/portal")
})

test("ni org ni client => onboarding (compte neuf, ou adhesion revoquee)", () => {
  assert.equal(landingFor({ orgMemberships: 0, clientMemberships: 0 }), "/onboarding")
})

test("l agence prime sur le portail quand on est les deux", () => {
  // Cas reel en phase solo : Etienne est owner de son org ET reviewer sur l un
  // de ses propres clients pour tester le portail.
  assert.equal(landingFor({ orgMemberships: 1, clientMemberships: 2 }), "/dashboard")
})

test("la sortie est toujours l une des trois destinations connues", () => {
  const connues = new Set(["/dashboard", "/portal", "/onboarding"])
  for (const o of [0, 1, 5]) {
    for (const c of [0, 1, 5]) {
      assert.ok(connues.has(landingFor({ orgMemberships: o, clientMemberships: c })), `${o}/${c}`)
    }
  }
})
