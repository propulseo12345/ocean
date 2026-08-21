import assert from "node:assert/strict"
import test from "node:test"

import { accountHealth, type HealthInputs } from "./account-health"

const SAIN: HealthInputs = {
  platform: "instagram",
  accountStatus: "connected",
  connectionStatus: "connected",
  connectionNeedsReauthAt: null,
  grantedScopes: ["instagram_basic", "instagram_content_publish"],
}

test("un compte sain reste sain", () => {
  assert.deepEqual(accountHealth(SAIN), { status: "connected", missing: [] })
})

test("LE TICKET : une connexion à reconnecter rend TOUS ses comptes à reconnecter", () => {
  // `needs_reauth_at` est écrit par le worker sur `platform_connections`, une
  // table que `getSocialAccounts` ne joignait jamais. L'écran affichait donc
  // « Connecté » en vert sur un compte incapable de publier, et l'utilisateur
  // découvrait le problème quand un contenu programmé partait en échec.
  const parNeedsReauthAt = accountHealth({
    ...SAIN,
    connectionNeedsReauthAt: "2026-08-17T10:00:00Z",
  })
  assert.equal(parNeedsReauthAt.status, "needs_reauth")

  const parStatut = accountHealth({ ...SAIN, connectionStatus: "needs_reauth" })
  assert.equal(parStatut.status, "needs_reauth")
})

test("le DÉTACHEMENT prime sur tout : on n'invite pas à défaire son propre geste", () => {
  const d = accountHealth({
    ...SAIN,
    accountStatus: "disconnected",
    connectionNeedsReauthAt: "2026-08-17T10:00:00Z",
    connectionStatus: "needs_reauth",
  })
  assert.deepEqual(d, { status: "disconnected", missing: [] })
})

test("un compte connecté SANS le scope d'écriture est signalé (P8-6 + P8-7)", () => {
  // Le cas qui n'a pas de statut : la connexion est vivante, le token valide,
  // et pourtant tout POST sera refusé. Meta ne rétro-accorde jamais un scope :
  // seule une reconnexion peut le donner.
  const h = accountHealth({
    ...SAIN,
    platform: "facebook",
    grantedScopes: ["pages_show_list", "instagram_basic"],
  })
  assert.equal(h.status, "connected")
  assert.deepEqual(h.missing, ["pages_manage_posts"])
})

test("⚠ scopes VIDES = « on ne sait pas », pas « rien n'est accordé »", () => {
  // Les connexions créées avant P8-6 stockaient les scopes DEMANDÉS ; celles
  // dont le fournisseur n'annonce rien stockent un tableau vide. Crier « ne peut
  // pas publier » sur toutes transformerait l'alerte en bruit dès le premier
  // jour — et une alerte bruyante finit ignorée, y compris quand elle a raison.
  const h = accountHealth({ ...SAIN, grantedScopes: [] })
  assert.deepEqual(h.missing, [])
  assert.equal(h.status, "connected")
})

test("PROPRIÉTÉ : aucune combinaison dégradée ne rend « connecté sans réserve »", () => {
  const statutsCompte = ["connected", "needs_reauth", "disconnected"] as const
  const statutsConnexion = ["connected", "needs_reauth", "disconnected", null] as const
  const reauthAt = [null, "2026-08-17T10:00:00Z"]
  const scopes = [["instagram_basic", "instagram_content_publish"], ["instagram_basic"], []]

  let sains = 0
  let essais = 0
  for (const a of statutsCompte) {
    for (const c of statutsConnexion) {
      for (const r of reauthAt) {
        for (const s of scopes) {
          essais++
          const h = accountHealth({
            platform: "instagram",
            accountStatus: a,
            connectionStatus: c,
            connectionNeedsReauthAt: r,
            grantedScopes: s,
          })
          const sansRéserve = h.status === "connected" && h.missing.length === 0
          if (sansRéserve) {
            sains++
            // Un « tout va bien » ne peut sortir que d'un état réellement bon.
            assert.equal(a, "connected", `compte ${a} déclaré sain`)
            assert.ok(c === "connected" || c === null, `connexion ${c} déclarée saine`)
            assert.equal(r, null, "reconnexion demandée mais compte déclaré sain")
            assert.ok(
              s.length === 0 || s.includes("instagram_content_publish"),
              `scopes ${JSON.stringify(s)} déclarés suffisants`
            )
          }
        }
      }
    }
  }
  assert.ok(essais >= 72)
  assert.ok(sains > 0, "aucune combinaison saine — la propriété ne prouverait rien")
})

test("une connexion absente (compte orphelin) ne fabrique pas une fausse alerte", () => {
  // `connectionStatus: null` = la jointure n'a rien rendu. On ne peut pas en
  // conclure que le compte est cassé ; on s'en remet à son propre statut.
  const h = accountHealth({ ...SAIN, connectionStatus: null })
  assert.equal(h.status, "connected")
})
