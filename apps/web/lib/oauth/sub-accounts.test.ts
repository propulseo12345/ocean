import assert from "node:assert/strict"
import test from "node:test"

import {
  type AvailableSubAccount,
  cleDeSousCompte,
  parseAvailableSubAccounts,
  parseCleDeSousCompte,
  selectAttachable,
} from "./sub-accounts"

const CATALOGUE: AvailableSubAccount[] = [
  { platform: "facebook", providerAccountId: "page-A", displayName: "Client A" },
  { platform: "instagram", providerAccountId: "ig-A", username: "clienta" },
  { platform: "facebook", providerAccountId: "page-B", displayName: "Client B" },
  { platform: "instagram", providerAccountId: "ig-B", username: "clientb" },
]

test("LE TICKET : on ne rattache QUE ce qui est explicitement demandé", () => {
  // Avant P8-1, connecter Meta depuis l'espace du client A rattachait les
  // QUATRE — donc les comptes du client B, avec leurs tokens de publication.
  const choisis = selectAttachable(CATALOGUE, [
    cleDeSousCompte("facebook", "page-A"),
    cleDeSousCompte("instagram", "ig-A"),
  ])
  assert.equal(choisis.length, 2)
  assert.deepEqual(choisis.map((c) => c.providerAccountId).sort(), ["ig-A", "page-A"])
})

test("GARDE : un identifiant fabriqué par le navigateur n'est jamais rattaché", () => {
  // La liste demandée vient du formulaire, donc du client. Sans recoupement,
  // une ligne `social_accounts` désignerait une Page que la connexion ne possède
  // pas — et le worker tenterait de publier dessus.
  const choisis = selectAttachable(CATALOGUE, [
    cleDeSousCompte("facebook", "page-A"),
    cleDeSousCompte("facebook", "page-du-voisin"),
    cleDeSousCompte("instagram", "999999"),
  ])
  assert.deepEqual(
    choisis.map((c) => c.providerAccountId),
    ["page-A"]
  )
})

test("GARDE : le rapprochement porte sur (plateforme, identifiant), pas sur l'identifiant seul", () => {
  // Chez Meta un même identifiant numérique peut exister des deux côtés.
  // Ne comparer que l'identifiant laisserait rattacher un compte Instagram
  // sous l'étiquette Facebook — donc publier via la mauvaise API.
  const ambigu: AvailableSubAccount[] = [
    { platform: "facebook", providerAccountId: "1234" },
    { platform: "instagram", providerAccountId: "1234" },
  ]
  const choisis = selectAttachable(ambigu, [cleDeSousCompte("instagram", "1234")])
  assert.equal(choisis.length, 1)
  assert.equal(choisis[0].platform, "instagram")
})

test("PROPRIÉTÉ : la sélection est toujours un sous-ensemble du catalogue", () => {
  // Balayage de toutes les parties du catalogue, plus du bruit à chaque fois.
  const clés = CATALOGUE.map((c) => cleDeSousCompte(c.platform, c.providerAccountId))
  const connues = new Set(clés)

  for (let masque = 0; masque < 1 << clés.length; masque++) {
    const demandés = clés.filter((_, i) => (masque >> i) & 1)
    const avecBruit = [...demandés, "facebook:intrus", "instagram:", ":x", "", "n-importe-quoi"]
    const choisis = selectAttachable(CATALOGUE, avecBruit)

    for (const c of choisis) {
      assert.ok(
        connues.has(cleDeSousCompte(c.platform, c.providerAccountId)),
        `${c.platform}:${c.providerAccountId} n'est pas du catalogue`
      )
    }
    assert.equal(choisis.length, demandés.length, `masque ${masque}`)
  }
})

test("une sélection vide ne rattache rien", () => {
  assert.deepEqual(selectAttachable(CATALOGUE, []), [])
})

test("parseAvailableSubAccounts relit un catalogue bien formé", () => {
  const meta = {
    available_accounts: [
      { platform: "facebook", providerAccountId: "p1", displayName: "Page 1", followers: 12 },
      { platform: "instagram", providerAccountId: "i1", username: "compte" },
    ],
  }
  const lus = parseAvailableSubAccounts(meta)
  assert.equal(lus.length, 2)
  assert.equal(lus[0].displayName, "Page 1")
  assert.equal(lus[0].followers, 12)
  assert.equal(lus[1].username, "compte")
})

test("un metadata absent, étranger ou malformé ne fabrique aucun sous-compte", () => {
  // `metadata` est un jsonb libre : il peut avoir été écrit par une version
  // antérieure, ou à la main dans le SQL Editor. On ignore, on ne devine pas.
  for (const mauvais of [null, undefined, {}, 42, "texte", { available_accounts: null }]) {
    assert.deepEqual(parseAvailableSubAccounts(mauvais), [])
  }
  const partiel = {
    available_accounts: [
      { platform: "tiktok", providerAccountId: "ok" },
      { platform: "myspace", providerAccountId: "x" },
      { platform: "facebook" },
      { platform: "facebook", providerAccountId: "" },
      { platform: "facebook", providerAccountId: 42 },
      "pas un objet",
      null,
    ],
  }
  const lus = parseAvailableSubAccounts(partiel)
  assert.equal(lus.length, 1)
  assert.equal(lus[0].providerAccountId, "ok")
})

test("les clés de formulaire font l'aller-retour, y compris sur un id contenant «:»", () => {
  for (const [p, id] of [
    ["facebook", "123"],
    ["instagram", "17841400000000000"],
    ["tiktok", "open:id:avec:deux-points"],
  ] as const) {
    const rond = parseCleDeSousCompte(cleDeSousCompte(p, id))
    assert.deepEqual(rond, { platform: p, providerAccountId: id })
  }
  for (const mauvais of ["", ":", "facebook:", ":123", "sansdeuxpoints"]) {
    assert.equal(parseCleDeSousCompte(mauvais), null, `«${mauvais}» accepté à tort`)
  }
})
