import assert from "node:assert/strict"
import { test } from "node:test"
import type pg from "pg"
import type { PublishJob } from "./domain"
import type { FetchLike } from "./http"
import type { PublishContext } from "./publishers/types"
import { createQuotaChecker } from "./quota-check"
import { createInstagramQuotaProbe, parseBucHeader } from "./quota-remote"

// La moitié DISTANTE de la règle 19. Ce que ces tests refusent :
//   - une sonde en panne qui empêche de publier (la précaution devenue panne) ;
//   - `call_count` lu comme un nombre d'appels alors que c'est un pourcentage ;
//   - une fenêtre de plateforme repoussée à chaque relevé, qui gèlerait un
//     compte au plafond pour toujours.

const JOB = {
  id: "job-1",
  orgId: "org-1",
  clientId: "client-1",
  socialAccountId: "acct-1",
  platform: "instagram",
} as PublishJob

const CTX = {
  accessToken: "PAGE-TOKEN",
  providerAccountId: "17841400000",
  media: [],
  caption: "",
  format: "post",
} as PublishContext

function fakePool(rows: Record<string, unknown>[] = [], now = new Date("2026-08-18T10:00:00Z")) {
  const sql: string[] = []
  const params: unknown[][] = []
  const pool = {
    query: async (q: string, p?: unknown[]) => {
      sql.push(q)
      params.push(p ?? [])
      if (q.includes("select now()")) return { rows: [{ now }] }
      if (q.includes("from public.social_account_quota_usage")) return { rows }
      return { rows: [] }
    },
  }
  return { pool: pool as unknown as pg.Pool, sql, params }
}

// --- sonde Instagram --------------------------------------------------------

test("IG : GET content_publishing_limit, quota_usage et quota_total remontent", async () => {
  let url = ""
  const fetch: FetchLike = async (u) => {
    url = u
    return new Response(
      JSON.stringify({
        data: [{ quota_usage: 37, config: { quota_total: 100, quota_duration: 86400 } }],
      }),
      { status: 200 }
    )
  }
  const snap = await createInstagramQuotaProbe(fetch, "https://graph.test/v21.0")(JOB, CTX)

  assert.ok(url.includes("17841400000/content_publishing_limit"))
  assert.deepEqual(
    { kind: snap?.kind, used: snap?.used, limit: snap?.limit, windowSeconds: snap?.windowSeconds },
    { kind: "ig_publish", used: 37, limit: 100, windowSeconds: 86400 }
  )
})

test("IG : une reponse vide ne fabrique pas un compteur a zero", async () => {
  const fetch: FetchLike = async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
  const snap = await createInstagramQuotaProbe(fetch, "https://graph.test/v21.0")(JOB, CTX)
  // `null` = « la plateforme n'a rien dit ». Ecrire used=0 effacerait le
  // compteur local et autoriserait 100 posts de plus.
  assert.equal(snap, null)
})

// --- en-tete BUC Facebook ---------------------------------------------------

test("BUC : call_count est un POURCENTAGE, pas un nombre d'appels", () => {
  const header = JSON.stringify({
    "1122334455": [{ type: "pages", call_count: 28, total_cputime: 2, total_time: 3 }],
  })
  const snap = parseBucHeader(header, "1122334455")
  assert.equal(snap?.used, 28)
  // Le lire comme un compte d'appels afficherait « 28/4800 » la ou Meta dit
  // « 28 % consommes » : une jauge fausse d'un facteur ~170.
  assert.equal(snap?.limit, 100)
  assert.equal(snap?.kind, "fb_buc")
})

test("BUC : en-tete absent, illisible, ou pour une AUTRE Page => rien", () => {
  assert.equal(parseBucHeader(null, "1122334455"), null)
  assert.equal(parseBucHeader("pas du json", "1122334455"), null)
  assert.equal(
    parseBucHeader(JSON.stringify({ "9999": [{ call_count: 5 }] }), "1122334455"),
    null,
    "l'en-tete porte plusieurs Pages : prendre la mauvaise ligne serait pire que rien"
  )
})

// --- decision ---------------------------------------------------------------

test("la sonde est interrogee AVANT la decision, et son resultat est ecrit en source='api'", async () => {
  const { pool, sql, params } = fakePool([{ used: 37, window_resets_at: null }])
  let probed = false
  const check = createQuotaChecker(pool, {
    stub: false,
    probes: {
      instagram: async () => {
        probed = true
        return { kind: "ig_publish", used: 37, limit: 100, windowSeconds: 86400, raw: {} }
      },
    },
  })
  await check(JOB, CTX)

  assert.ok(probed, "la plateforme fait foi : on l'interroge d'abord")
  const upsert = sql.find((s) => s.includes("insert into public.social_account_quota_usage"))
  assert.ok(upsert, "le releve distant est PERSISTE")
  assert.ok(upsert?.includes("'api'"), "avec source = 'api', pas 'local'")
  // `source` existe deja dans le schema (014:112, check 014:123) : aucune
  // migration n'est necessaire.
  assert.ok(params.some((p) => p.includes("ig_publish")))
})

test("UNE SONDE EN PANNE NE BLOQUE PAS LA PUBLICATION", async () => {
  const { pool } = fakePool([{ used: 3, window_resets_at: new Date("2026-08-19T00:00:00Z") }])
  const check = createQuotaChecker(pool, {
    stub: false,
    probes: {
      instagram: async () => {
        throw new Error("graph down")
      },
    },
  })
  // Transformer une verification en point de panne rendrait la precaution plus
  // dangereuse que son absence : on retombe sur le compteur local.
  assert.deepEqual(await check(JOB, CTX), { ok: true })
})

test("la sonde distante fait DEPASSER le plafond => report, pas echec", async () => {
  // Le compteur local disait 3 ; la plateforme dit 100 (posts faits hors Ocean).
  const { pool } = fakePool([{ used: 100, window_resets_at: new Date("2026-08-18T18:00:00Z") }])
  const check = createQuotaChecker(pool, {
    stub: false,
    probes: {
      instagram: async () => ({
        kind: "ig_publish",
        used: 100,
        limit: 100,
        windowSeconds: 86400,
        raw: {},
      }),
    },
  })
  const verdict = await check(JOB, CTX)
  assert.equal(verdict.ok, false)
  if (verdict.ok) return
  // Le refus dit QUAND reessayer : reporter de 60 s en boucle epuiserait la
  // fenetre de grace et transformerait un quota atteint en publication perdue.
  assert.ok(verdict.retryAfterMs > 60_000)
})

test("FACEBOOK a bien un plafond distant : 100 % de BUC consomme => report", async () => {
  // Sans cette ligne, `LOCAL_QUOTAS.facebook` etant null, le worker laissait
  // passer en le journalisant. Le BUC releve en sortie d'appel donne enfin un
  // plafond honnete.
  const { pool } = fakePool([{ used: 100, window_resets_at: new Date("2026-08-18T18:00:00Z") }])
  const check = createQuotaChecker(pool, { stub: false })
  const verdict = await check({ ...JOB, platform: "facebook" } as PublishJob, CTX)
  assert.equal(verdict.ok, false)
})

test("facebook a 42 % de BUC : on publie", async () => {
  const { pool } = fakePool([{ used: 42, window_resets_at: new Date("2026-08-18T18:00:00Z") }])
  const check = createQuotaChecker(pool, { stub: false })
  assert.deepEqual(await check({ ...JOB, platform: "facebook" } as PublishJob, CTX), { ok: true })
})

test("stub : aucune sonde, aucune ecriture — la simulation ne consomme rien", async () => {
  const { pool, sql } = fakePool()
  let probed = false
  const check = createQuotaChecker(pool, {
    stub: true,
    probes: {
      instagram: async () => {
        probed = true
        return null
      },
    },
  })
  assert.deepEqual(await check(JOB, CTX), { ok: true })
  assert.equal(probed, false)
  assert.equal(sql.length, 0)
})

test("la fenetre de la plateforme n'est PAS repoussee a chaque releve", async () => {
  const { pool, sql } = fakePool([{ used: 5, window_resets_at: new Date("2026-08-18T18:00:00Z") }])
  const check = createQuotaChecker(pool, {
    stub: false,
    probes: {
      instagram: async () => ({
        kind: "ig_publish",
        used: 5,
        limit: 100,
        windowSeconds: 86400,
        raw: {},
      }),
    },
  })
  await check(JOB, CTX)
  const upsert = sql.find((s) => s.includes("insert into public.social_account_quota_usage"))
  // Ecraser window_resets_at a chaque appel repousserait indefiniment la
  // reouverture : un compte au plafond y resterait pour toujours.
  assert.ok(upsert?.includes("window_resets_at is null"))
  assert.ok(upsert?.includes("<= now()"))
})
