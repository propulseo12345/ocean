import assert from "node:assert/strict"
import { test } from "node:test"
import { decideQuota, LOCAL_QUOTAS, type QuotaRow } from "./quota"

// Toute la logique de fenêtre du compteur local (règle 19). Fonction pure, donc
// testée directement — c'est elle qui décide si un post part ou est reporté.

const IG = LOCAL_QUOTAS.instagram
if (!IG) throw new Error("instagram doit avoir un quota local")

const NOW = new Date("2026-07-22T12:00:00.000Z")

function row(used: number, resetsInMs: number | null): QuotaRow {
  return {
    used,
    windowResetsAt: resetsInMs === null ? null : new Date(NOW.getTime() + resetsInMs),
  }
}

test("aucun compteur encore : la publication passe", () => {
  assert.deepEqual(decideQuota(IG, null, NOW), { ok: true })
})

test("sous la limite : la publication passe", () => {
  assert.deepEqual(decideQuota(IG, row(99, 3_600_000), NOW), { ok: true })
})

test("plafond atteint => report jusqu'à la RÉOUVERTURE de la fenêtre, pas 60 s", () => {
  const verdict = decideQuota(IG, row(100, 6 * 3_600_000), NOW)
  assert.equal(verdict.ok, false)
  if (verdict.ok) return
  // 6 h + 1 min de marge. Le comportement d'avant reportait de 60 s en boucle
  // jusqu'à dépasser la fenêtre de grâce de 2 h — donc dead_letter, donc
  // publication perdue, à l'inverse de la décision actée.
  assert.equal(verdict.retryAfterMs, 6 * 3_600_000 + 60_000)
  assert.match(verdict.reason, /ig_publish/)
})

// LE piège signalé par l'audit : une ligne `used = 100` sans date de reset
// bloquerait le compte INDÉFINIMENT, sans qu'aucun code ne puisse la débloquer.
test("compteur plein mais fenêtre SANS date de reset => on ne bloque pas à vie", () => {
  assert.deepEqual(decideQuota(IG, row(100, null), NOW), { ok: true })
})

test("compteur plein mais fenêtre ÉCHUE => la fenêtre repart, la publication passe", () => {
  assert.deepEqual(decideQuota(IG, row(100, -1000), NOW), { ok: true })
})

test("le report ne dépasse jamais une fenêtre entière", () => {
  // Donnée aberrante (reset dans 30 jours) : on refuse de programmer un réveil
  // dans un mois sur la foi d'une ligne de cache.
  const verdict = decideQuota(IG, row(100, 30 * 24 * 3_600_000), NOW)
  assert.equal(verdict.ok, false)
  if (verdict.ok) return
  assert.equal(verdict.retryAfterMs, IG.windowSeconds * 1000 + 60_000)
})

test("TikTok : 5 brouillons / 24 h, et Facebook n'a PAS de quota local", () => {
  assert.equal(LOCAL_QUOTAS.tiktok?.limit, 5, "5 brouillons en attente / 24 h par créateur")
  assert.equal(LOCAL_QUOTAS.tiktok?.kind, "tt_draft")
  // Volontaire : le BUC dépend de l'engagement de la Page, il n'est pas
  // calculable localement. Un chiffre inventé serait pire qu'une absence assumée.
  assert.equal(LOCAL_QUOTAS.facebook, null)
})
