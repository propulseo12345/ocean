import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createHealthState,
  healthReport,
  markTickFailed,
  markTickOk,
  startHealthServer,
} from "./health"

// Ce que ces tests protègent : un worker qui échoue sur 100 % de ses ticks restait
// « running / healthy » pour Coolify, indéfiniment, sans publier une seule fois.
// La santé ne se déduit donc PAS de « le process vit » mais de « un tick a réussi
// récemment ».

const T0 = 1_000_000
const POLL = 5_000
const OPTS = { pollIntervalMs: POLL, staleTicks: 6 } // tolérance = 30 s

test("au demarrage : sain pendant la fenetre de tolerance, malade ensuite", () => {
  const s = createHealthState(T0)

  assert.equal(healthReport(s, { ...OPTS, now: T0 }).status, "starting")
  assert.equal(healthReport(s, { ...OPTS, now: T0 + 29_000 }).ok, true)

  // Jamais aucun tick reussi passe la tolerance => on ne se declare pas sain.
  const late = healthReport(s, { ...OPTS, now: T0 + 31_000 })
  assert.equal(late.ok, false)
  assert.equal(late.status, "stale")
  assert.equal(late.ageMs, null)
})

test("un tick reussi rend sain et remet le compteur d'echecs a zero", () => {
  const s = createHealthState(T0)
  markTickFailed(s, T0 + 1000)
  markTickFailed(s, T0 + 2000)
  assert.equal(s.consecutiveFailures, 2)

  markTickOk(s, T0 + 3000)
  assert.equal(s.consecutiveFailures, 0)

  const r = healthReport(s, { ...OPTS, now: T0 + 4000 })
  assert.equal(r.ok, true)
  assert.equal(r.status, "ok")
  assert.equal(r.ageMs, 1000)
})

test("LE CAS QUI COMPTE : des ticks qui echouent en boucle finissent par declarer malade", () => {
  const s = createHealthState(T0)
  markTickOk(s, T0) // le worker a bien demarre...

  // ...puis le pooler bascule : 100 % d'echecs pendant 40 s.
  for (let i = 1; i <= 8; i++) markTickFailed(s, T0 + i * POLL)

  const r = healthReport(s, { ...OPTS, now: T0 + 8 * POLL })
  assert.equal(r.ok, false, "503 : aucun tick reussi depuis 40 s")
  assert.equal(r.status, "stale")
  assert.equal(r.consecutiveFailures, 8)
  assert.equal(r.totalFailures, 8)
})

interface HealthBody {
  status: string
  workerId: string
  publishersMode: string
  consecutiveFailures: number
}

test("le serveur HTTP repond 200 quand sain, 503 quand perime", async () => {
  const state = createHealthState(T0)
  let clockNow = T0
  markTickOk(state, T0)

  const port = 45_517
  const server = startHealthServer(state, {
    port,
    workerId: "w-test",
    publishersMode: "dry-run",
    pollIntervalMs: POLL,
    staleTicks: 6,
    clock: () => clockNow,
  })
  await new Promise((r) => setTimeout(r, 150))

  try {
    const ok = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(ok.status, 200)
    const body = (await ok.json()) as HealthBody
    assert.equal(body.status, "ok")
    assert.equal(body.publishersMode, "dry-run", "le mode est observable a l'exploitation")
    assert.equal(body.workerId, "w-test")

    // 40 s plus tard, toujours aucun tick reussi.
    clockNow = T0 + 40_000
    const stale = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(stale.status, 503, "Coolify doit pouvoir constater la panne")
    assert.equal(((await stale.json()) as HealthBody).status, "stale")
  } finally {
    await server.close()
  }
})
