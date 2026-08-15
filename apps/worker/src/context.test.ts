import assert from "node:assert/strict"
import { test } from "node:test"
import type pg from "pg"
import { createContextProvider, TokenRefreshTimeoutError } from "./context"
import { composeCaption, loadPublishTarget } from "./db/publish-target"
import { NeedsReauthError, PermanentPublishError, type PublishJob } from "./domain"
import type { StorageSigner } from "./media/storage-signer"

// T1-2 — les deux coutures du contexte de publication : le token FRAIS et la
// légende. Aucune base : un faux pool répond par requête reconnue à son SQL.

const JOB = {
  id: "job-1",
  socialAccountId: "acct-1",
  contentItemId: "item-1",
  contentTargetId: "target-1",
  platform: "instagram",
} as PublishJob

/** Faux pool : aiguille sur un fragment du SQL, rend les lignes demandées. */
function fakePool(routes: { match: string; rows: Record<string, unknown>[] }[]) {
  const seen: string[] = []
  const pool = {
    query: async (sql: string) => {
      seen.push(sql)
      for (const r of routes) {
        if (sql.includes(r.match)) return { rows: r.rows }
      }
      return { rows: [] }
    },
  }
  return { pool: pool as unknown as pg.Pool, seen }
}

const TARGET_ROW = {
  provider_account_id: "ig-user-42",
  platform_connection_id: "conn-1",
  account_status: "connected",
  connection_provider: "facebook",
  connection_status: "connected",
  caption: "Bonjour",
  hashtags: ["seo", "web"],
  format: "post",
  first_comment: null,
  caption_override: null,
}

const SECRET_ROW = { account_secret: "sec-1", connection_secret: null }
const VAULT_ROW = { decrypted_secret: "PAGE-TOKEN" }

function pooling(over: { target?: Record<string, unknown> | null } = {}) {
  return fakePool([
    {
      // `ct.caption_override` n'apparait que dans la requete de cible : la
      // requete des secrets lit AUSSI `from public.social_accounts sa`, et
      // s'aiguiller dessus les confondrait.
      match: "ct.caption_override",
      rows: over.target === null ? [] : [over.target ?? TARGET_ROW],
    },
    { match: "as account_secret", rows: [SECRET_ROW] },
    { match: "from vault.decrypted_secrets where id", rows: [VAULT_ROW] },
  ])
}

const NO_STORAGE: StorageSigner = { sign: async () => [] }

// --- composeCaption ---------------------------------------------------------

test("composeCaption : les hashtags sont REINJECTES (ils vivent a part en base)", () => {
  assert.equal(
    composeCaption({ captionOverride: null, caption: "Bonjour", hashtags: ["seo", "web"] }),
    "Bonjour\n\n#seo #web"
  )
  // Convention miroir du composer (composer-types.ts:206). Publier `caption`
  // seul amputerait chaque post de ses hashtags, sans erreur ni trace.
})

test("composeCaption : un override de cible est pris TEL QUEL", () => {
  assert.equal(
    composeCaption({
      captionOverride: "Version Facebook #fb",
      caption: "Bonjour",
      hashtags: ["seo"],
    }),
    "Version Facebook #fb",
    "l'override vient d'un champ a hashtags inline : le completer les doublerait"
  )
})

test("composeCaption : cas vides, et le # n'est jamais double", () => {
  assert.equal(composeCaption({ captionOverride: "", caption: null, hashtags: [] }), "")
  assert.equal(composeCaption({ captionOverride: null, caption: null, hashtags: ["a"] }), "#a")
  assert.equal(composeCaption({ captionOverride: null, caption: "x", hashtags: ["#a"] }), "x\n\n#a")
  assert.equal(composeCaption({ captionOverride: "   ", caption: "x", hashtags: [] }), "x")
})

// --- loadPublishTarget : les etats de compte -------------------------------

test("compte detache (036) => PERMANENT, et surtout PAS needs_reauth", async () => {
  const { pool } = pooling({ target: { ...TARGET_ROW, account_status: "disconnected" } })
  await assert.rejects(
    () => loadPublishTarget(pool, JOB),
    (err: unknown) => {
      assert.ok(err instanceof PermanentPublishError)
      assert.ok(
        !(err instanceof NeedsReauthError),
        "un compte detache volontairement n'attend aucune reconnexion (036)"
      )
      return true
    }
  )
})

test("compte en needs_reauth => NeedsReauth avant meme d'appeler la plateforme", async () => {
  const { pool } = pooling({ target: { ...TARGET_ROW, connection_status: "needs_reauth" } })
  await assert.rejects(() => loadPublishTarget(pool, JOB), (err) => err instanceof NeedsReauthError)
})

test("compte introuvable => permanent (aucun retry ne le fera revenir)", async () => {
  const { pool } = pooling({ target: null })
  await assert.rejects(
    () => loadPublishTarget(pool, JOB),
    (err) => err instanceof PermanentPublishError
  )
})

// --- prepare() --------------------------------------------------------------

test("prepare : le refresh est appele AVANT la lecture du token", async () => {
  const order: string[] = []
  const { pool } = pooling()
  const wrapped = {
    query: async (sql: string) => {
      if (sql.includes("vault.decrypted_secrets")) order.push("lecture-token")
      // biome-ignore lint/suspicious/noExplicitAny: delegation au faux pool
      return (pool as any).query(sql)
    },
  } as unknown as pg.Pool

  const prepare = createContextProvider(wrapped, {
    stub: false,
    storage: NO_STORAGE,
    refresh: {
      run: async () => {
        order.push("refresh")
      },
      timeoutMs: 1000,
    },
  })
  const ctx = await prepare(JOB)

  assert.deepEqual(order.slice(0, 2), ["refresh", "lecture-token"])
  assert.equal(ctx.accessToken, "PAGE-TOKEN")
  assert.equal(ctx.providerAccountId, "ig-user-42")
  assert.equal(ctx.caption, "Bonjour\n\n#seo #web")
})

test("LE PIEGE DU LEASE : un refresh pendu est borne, il ne mange pas les 2 min", async () => {
  const { pool } = pooling()
  const prepare = createContextProvider(pool, {
    stub: false,
    storage: NO_STORAGE,
    // Un fournisseur qui ne répond ni ne coupe. Sans borne, le lease expirerait,
    // le reaper rendrait le job, et un SECOND worker rafraîchirait le même
    // compte — deux échanges concurrents, ce que la règle 14 interdit.
    refresh: { run: () => new Promise<void>(() => {}), timeoutMs: 20 },
  })
  await assert.rejects(() => prepare(JOB), (err) => err instanceof TokenRefreshTimeoutError)
})

test("prepare : aucun media signe quand il n'y a pas de signataire", async () => {
  const { pool } = pooling()
  const prepare = createContextProvider(pool, { stub: false, storage: null, refresh: null })
  const ctx = await prepare(JOB)
  assert.deepEqual(ctx.media, [])
})

test("prepare : sans token, NeedsReauth (on ne part pas publier sans identite)", async () => {
  const { pool } = fakePool([
    { match: "ct.caption_override", rows: [TARGET_ROW] },
    {
      match: "as account_secret",
      rows: [{ account_secret: null, connection_secret: null }],
    },
  ])
  const prepare = createContextProvider(pool, { stub: false, storage: null, refresh: null })
  await assert.rejects(() => prepare(JOB), (err) => err instanceof NeedsReauthError)
})

test("stub : ni refresh, ni cible, ni signature — la simulation n'appelle personne", async () => {
  let refreshed = false
  const { pool, seen } = pooling()
  const prepare = createContextProvider(pool, {
    stub: true,
    storage: {
      sign: async () => {
        throw new Error("le stub ne doit rien signer")
      },
    },
    refresh: {
      run: async () => {
        refreshed = true
      },
      timeoutMs: 1000,
    },
  })
  const ctx = await prepare(JOB)

  assert.equal(refreshed, false, "consommer un refresh token TikTok pour une simulation")
  assert.equal(ctx.accessToken, "PAGE-TOKEN")
  assert.deepEqual(ctx.media, [])
  assert.ok(
    !seen.some((s) => s.includes("ct.caption_override")),
    "le stub ne lit meme pas la cible"
  )
})
