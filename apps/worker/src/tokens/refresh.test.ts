import assert from "node:assert/strict"
import test from "node:test"
import { type RefreshDeps, type RefreshState, refreshConnection } from "./refresh.js"
import { decideRefresh, peutEcrireResultat, REFRESH_MARGIN_DAYS } from "./refresh-plan.js"

const JOUR = 24 * 60 * 60 * 1000
const T0 = 1_760_000_000_000
const dans = (j: number) => new Date(T0 + j * JOUR).toISOString()

// ---------------------------------------------------------------------------
// Faux pool : il JOURNALISE la séquence begin/lock/commit, ce qui permet de
// prouver que l'appel réseau tombe entre deux transactions et non dedans.
// ---------------------------------------------------------------------------
function fauxPool(journal: string[]) {
  const client = {
    query: async (sql: string) => {
      if (sql.startsWith("begin")) journal.push("begin")
      else if (sql.includes("pg_advisory_xact_lock")) journal.push("lock")
      else if (sql.startsWith("commit")) journal.push("commit")
      else if (sql.startsWith("rollback")) journal.push("rollback")
      return { rows: [] }
    },
    release: () => journal.push("release"),
  }
  return { connect: async () => client } as never
}

function état(overrides: Partial<RefreshState> = {}): RefreshState {
  return {
    connectionId: "conn-1",
    provider: "tiktok",
    tokenExpiresAt: dans(1),
    refreshTokenExpiresAt: dans(30),
    refreshToken: "refresh-A",
    canSelfRefresh: true,
    ...overrides,
  }
}

function deps(journal: string[], overrides: Partial<RefreshDeps> = {}): RefreshDeps {
  return {
    pool: fauxPool(journal),
    load: async () => état(),
    exchange: async () => {
      journal.push("http")
      return {
        accessToken: "nouveau",
        refreshToken: "refresh-B",
        expiresAt: dans(60),
        refreshTokenExpiresAt: dans(90),
      }
    },
    save: async () => {
      journal.push("save")
    },
    markNeedsReauth: async () => {
      journal.push("needs_reauth")
    },
    now: () => T0,
    ...overrides,
  }
}

test("LE TICKET : l'appel HTTP tombe ENTRE deux transactions, jamais dedans", async () => {
  const journal: string[] = []
  const res = await refreshConnection(deps(journal), "conn-1")

  assert.equal(res.kind, "refreshed")
  // La séquence doit montrer une transaction fermée AVANT le réseau, et une
  // seconde ouverte APRÈS. Tenir un verrou pendant un appel réseau immobilise
  // une connexion du pool et le compte — pour un fournisseur qui ne répond
  // jamais, indéfiniment (règle 18).
  const iHttp = journal.indexOf("http")
  const commitsAvant = journal.slice(0, iHttp).filter((e) => e === "commit").length
  const begins = journal.slice(0, iHttp).filter((e) => e === "begin").length

  assert.ok(iHttp > 0, "aucun appel réseau")
  assert.equal(begins, 1, "une seule transaction avant le réseau")
  assert.equal(commitsAvant, 1, "la transaction n'est PAS fermée avant l'appel réseau")
  // Et l'écriture se fait bien dans une transaction ouverte après.
  assert.ok(journal.indexOf("save") > iHttp)
  assert.ok(journal.lastIndexOf("begin") > iHttp)
})

test("LE TICKET : un échange concurrent n'est JAMAIS écrasé (compare-and-swap)", async () => {
  const journal: string[] = []
  let appels = 0
  const res = await refreshConnection(
    deps(journal, {
      load: async () => {
        appels++
        // Phase ① voit `refresh-A` ; entre-temps un autre worker a tourné, donc
        // la phase ③ voit `refresh-Z`. Chez TikTok/Microsoft son échange a
        // invalidé `refresh-A` : écrire notre résultat casserait le compte.
        return état({ refreshToken: appels === 1 ? "refresh-A" : "refresh-Z" })
      },
    }),
    "conn-1"
  )

  assert.deepEqual(res, { kind: "abandonne", reason: "concurrence" })
  assert.ok(journal.includes("http"), "l'échange a bien eu lieu")
  assert.ok(!journal.includes("save"), "le résultat périmé a été ÉCRIT")
})

test("un échec d'échange conclut needs_reauth au lieu de se taire", async () => {
  const journal: string[] = []
  const res = await refreshConnection(
    deps(journal, {
      exchange: async () => {
        journal.push("http")
        throw new Error("502")
      },
    }),
    "conn-1"
  )
  assert.equal(res.kind, "needs_reauth")
  assert.ok(journal.includes("needs_reauth"))
  assert.ok(!journal.includes("save"))
})

test("rien à faire : aucun appel réseau, aucune écriture", async () => {
  const journal: string[] = []
  const res = await refreshConnection(
    deps(journal, { load: async () => état({ tokenExpiresAt: dans(45) }) }),
    "conn-1"
  )
  assert.equal(res.kind, "skip")
  assert.ok(!journal.includes("http"), "échange déclenché sans raison")
  assert.ok(!journal.includes("save"))
})

test("une connexion introuvable ne déclenche ni réseau ni écriture", async () => {
  const journal: string[] = []
  const res = await refreshConnection(deps(journal, { load: async () => null }), "conn-1")
  assert.deepEqual(res, { kind: "abandonne", reason: "introuvable" })
  assert.ok(!journal.includes("http"))
})

// ---------------------------------------------------------------------------
// Décisions pures
// ---------------------------------------------------------------------------

test("un refresh token périmé conclut needs_reauth SANS tenter d'échange", () => {
  // L'ordre des tests compte : chercher d'abord ce qui rend l'échange
  // impossible évite de conclure « erreur réseau » là où la vraie réponse est
  // « reconnecte-toi ».
  const d = decideRefresh({
    tokenExpiresAt: dans(1),
    refreshTokenExpiresAt: dans(-1),
    hasRefreshToken: true,
    canSelfRefresh: true,
    nowMs: T0,
  })
  assert.deepEqual(d, { action: "needs_reauth", reason: "refresh_token_expire" })
})

test("Meta : dans la marge on ré-échange, échu on ne peut plus rien", () => {
  // Meta n'a pas de refresh token : il ré-échange un token ENCORE VALIDE.
  const commun = { refreshTokenExpiresAt: null, hasRefreshToken: false, canSelfRefresh: false }
  assert.deepEqual(decideRefresh({ ...commun, tokenExpiresAt: dans(5), nowMs: T0 }), {
    action: "refresh",
  })
  assert.deepEqual(decideRefresh({ ...commun, tokenExpiresAt: dans(-1), nowMs: T0 }), {
    action: "needs_reauth",
    reason: "aucun_moyen",
  })
  assert.deepEqual(decideRefresh({ ...commun, tokenExpiresAt: dans(40), nowMs: T0 }), {
    action: "skip",
    reason: "pas_echu",
  })
})

test("une échéance INCONNUE ne déclenche pas d'échange à l'aveugle", () => {
  // Chez un fournisseur à rotation, un échange inutile CONSOMME le refresh
  // token : le déclencher sans raison casserait un compte parfaitement sain.
  const d = decideRefresh({
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    hasRefreshToken: true,
    canSelfRefresh: true,
    nowMs: T0,
  })
  assert.deepEqual(d, { action: "skip", reason: "pas_echu" })
})

test("PROPRIÉTÉ : la décision est monotone — on ne repasse jamais de refresh à skip", () => {
  const ordre = { skip: 0, refresh: 1, needs_reauth: 2 }
  let précédent = -1
  for (let j = 60; j >= -5; j--) {
    const d = decideRefresh({
      tokenExpiresAt: dans(j),
      refreshTokenExpiresAt: null,
      hasRefreshToken: false,
      canSelfRefresh: false,
      nowMs: T0,
    })
    assert.ok(
      ordre[d.action] >= précédent,
      `à J-${j} la décision régresse (${d.action} après ${précédent})`
    )
    précédent = ordre[d.action]
  }
  assert.equal(précédent, ordre.needs_reauth, "on n'atteint jamais needs_reauth")
})

test("la marge est celle du CLAUDE.md, et la borne est franche", () => {
  assert.equal(REFRESH_MARGIN_DAYS, 10)
  const base = { refreshTokenExpiresAt: null, hasRefreshToken: true, canSelfRefresh: true }
  assert.equal(
    decideRefresh({ ...base, tokenExpiresAt: dans(REFRESH_MARGIN_DAYS + 1), nowMs: T0 }).action,
    "skip"
  )
  assert.equal(
    decideRefresh({ ...base, tokenExpiresAt: dans(REFRESH_MARGIN_DAYS), nowMs: T0 }).action,
    "refresh"
  )
})

test("peutEcrireResultat : identité stricte, y compris sur l'absence de token", () => {
  assert.equal(peutEcrireResultat("a", "a"), true)
  assert.equal(peutEcrireResultat("a", "b"), false)
  assert.equal(peutEcrireResultat(null, null), true)
  // Un token apparu entre-temps = quelqu'un est passé.
  assert.equal(peutEcrireResultat(null, "b"), false)
  assert.equal(peutEcrireResultat("a", null), false)
})
