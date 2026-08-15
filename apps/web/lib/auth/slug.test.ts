import assert from "node:assert/strict"
import { test } from "node:test"

import { slugCandidates, slugify } from "./slug"

// Ticket P7-4 — le slug d'organisation et sa collision.
// `signUpWithPassword` appelait `create_organization` sans lire son retour : une
// collision de slug (23505) partait en silence, et l'inscription se terminait sur
// un compte sans organisation.

test("les diacritiques sont depouilles, pas supprimes avec leur lettre", () => {
  assert.equal(slugify("Café Renard"), "cafe-renard")
  assert.equal(slugify("Étienne Guimbard"), "etienne-guimbard")
  assert.equal(slugify("Brûlerie Lacaze"), "brulerie-lacaze")
  assert.equal(slugify("Maison Verde"), "maison-verde")
})

test("la ponctuation devient un separateur unique, jamais en tete ni en queue", () => {
  assert.equal(slugify("Propul'SEO"), "propul-seo")
  assert.equal(slugify("  --Atelier   Nove--  "), "atelier-nove")
  assert.equal(slugify("A & B / C"), "a-b-c")
})

test("un nom sans aucun caractere exploitable retombe sur un slug valide", () => {
  // Sans ce garde-fou, le slug serait la chaine vide et l insert violerait la
  // contrainte de format au lieu de dire quelque chose d utile.
  for (const vide of ["", "   ", "!!!", "Ω≈√", "---", "日本語"]) {
    assert.equal(slugify(vide), "organisation", JSON.stringify(vide))
  }
})

test("une lettre latine cachee sous un diacritique compte comme exploitable", () => {
  // NFD decompose « ç » en « c » + cedille : il RESTE un « c ». Le slug est donc
  // "c", pas le repli — c est le comportement voulu, et ce test le fige (la
  // premiere version de ce fichier attendait le repli, a tort).
  assert.equal(slugify("Ω≈ç√"), "c")
  assert.equal(slugify("é"), "e")
})

test("le slug est borne, et ne finit jamais par un tiret", () => {
  const long = slugify("a".repeat(80))
  assert.equal(long.length, 40)

  // Une troncature qui tombe pile sur un separateur ne doit pas laisser de tiret.
  const coupe = slugify(`${"a".repeat(39)} suite`)
  assert.ok(!coupe.endsWith("-"), coupe)
  assert.ok(coupe.length <= 40)
})

test("les candidats sont distincts, ordonnes, et tous valides", () => {
  const candidats = slugCandidates("Marie Dupont", 4)
  assert.deepEqual(candidats, [
    "marie-dupont",
    "marie-dupont-2",
    "marie-dupont-3",
    "marie-dupont-4",
  ])
  assert.equal(new Set(candidats).size, candidats.length)
})

test("les candidats d un nom deja a la longueur maximale restent bornes et distincts", () => {
  const candidats = slugCandidates("b".repeat(80), 5)
  assert.equal(
    new Set(candidats).size,
    candidats.length,
    "des doublons rendraient la reprise inutile"
  )
  for (const c of candidats) {
    assert.ok(c.length <= 40, `${c} (${c.length})`)
    assert.ok(!c.endsWith("-"), c)
    assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(c), c)
  }
})
