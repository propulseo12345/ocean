import assert from "node:assert/strict"
import { test } from "node:test"
import { isLocalDatabaseUrl, loadConfig, resolvePublishersMode } from "./env"
import { assertLivePublishersAvailable, SIMULATED_PLATFORMS } from "./publishers"

// Gardes de DÉMARRAGE du worker. Ce qu'elles empêchent, dans l'ordre de gravité :
//   1. un worker en `stub` sur la base de production => content_targets marqués
//      'published' avec un permalink https://stub.local/… sur de vrais contenus,
//      cibles ensuite non ré-enfilables par enqueue_publish_jobs ;
//   2. un worker en `live` alors que les publishers sont encore des simulations,
//      soit exactement le même dégât ;
//   3. un worker sans mode explicite, qui devrait deviner.
// Aucune de ces gardes n'a de valeur de repli : elles lèvent.

const REMOTE =
  "postgresql://postgres.hgdeopkmkwyoumsfggrm:pw@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

test("isLocalDatabaseUrl : ferme par defaut, seul le loopback est local", () => {
  assert.equal(isLocalDatabaseUrl(LOCAL), true)
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@localhost:5432/db"), true)
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@[::1]:5432/db"), true)
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@host.docker.internal:5432/db"), true)
  assert.equal(isLocalDatabaseUrl(REMOTE), false)
  // Un hote qui CONTIENT « localhost » n'est pas le loopback.
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@localhost.evil.example:5432/db"), false)
  assert.equal(isLocalDatabaseUrl("pas-une-url"), false)
})

test("PUBLISHERS_MODE absent => refus de demarrer, aucune valeur par defaut", () => {
  assert.throws(() => resolvePublishersMode(undefined, REMOTE), /PUBLISHERS_MODE manquant/)
  assert.throws(() => resolvePublishersMode("", REMOTE), /PUBLISHERS_MODE manquant/)
  assert.throws(() => resolvePublishersMode("   ", REMOTE), /PUBLISHERS_MODE manquant/)
})

test("PUBLISHERS_MODE inconnu => refus (pas de repli silencieux sur stub)", () => {
  assert.throws(() => resolvePublishersMode("simulation", LOCAL), /invalide/)
  assert.throws(() => resolvePublishersMode("dryrun", LOCAL), /invalide/)
  assert.throws(() => resolvePublishersMode("true", LOCAL), /invalide/)
})

test("stub sur une base NON locale => refus de demarrer", () => {
  assert.throws(
    () => resolvePublishersMode("stub", REMOTE),
    /stub est interdit sur une base non locale/
  )
})

test("stub sur une base locale => accepte", () => {
  assert.equal(resolvePublishersMode("stub", LOCAL), "stub")
  assert.equal(
    resolvePublishersMode("  STUB  ", LOCAL),
    "stub",
    "insensible a la casse et aux espaces"
  )
})

test("dry-run : accepte partout, y compris sur la base de production", () => {
  assert.equal(resolvePublishersMode("dry-run", REMOTE), "dry-run")
  assert.equal(resolvePublishersMode("dry-run", LOCAL), "dry-run")
})

// La garde `live` a CHANGÉ DE RAISON, elle n'a pas disparu.
//
// Avant la phase 6, elle refusait « les publishers sont des stubs ». Les trois
// sont désormais réels, donc ce motif est éteint — et le supprimer sans rien
// mettre à la place aurait ouvert un trou pire que celui qu'il fermait : un
// worker `live` sans identifiants Meta démarre sans broncher et n'échoue qu'au
// PREMIER job, à l'heure exacte où un client attend son post.

test("live : la liste des simulations est vide, donc ce motif de refus est eteint", () => {
  assert.equal(resolvePublishersMode("live", REMOTE), "live")
  assert.equal(
    SIMULATED_PLATFORMS.length,
    0,
    "phase 6 : instagram, facebook et tiktok ont un publisher reel"
  )
})

test("live SANS identifiants => refus AU DEMARRAGE, et le message NOMME ce qui manque", () => {
  assert.throws(
    () => assertLivePublishersAvailable({}),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.match(msg, /identifiants plateforme manquants/)
      // Un refus qui n'apprend rien oblige a fouiller le code : les six
      // variables sont citees, avec la raison de chacune.
      for (const name of [
        "OAUTH_META_CLIENT_ID",
        "OAUTH_META_CLIENT_SECRET",
        "OAUTH_TIKTOK_CLIENT_KEY",
        "OAUTH_TIKTOK_CLIENT_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]) {
        assert.ok(msg.includes(name), `${name} devrait etre cite`)
      }
      return true
    }
  )
})

test("live : une SEULE variable manquante suffit a refuser, et elle est la seule citee", () => {
  const complet = {
    OAUTH_META_CLIENT_ID: "a",
    OAUTH_META_CLIENT_SECRET: "b",
    OAUTH_TIKTOK_CLIENT_KEY: "c",
    OAUTH_TIKTOK_CLIENT_SECRET: "d",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "f",
  }
  // Complet : la garde laisse passer.
  assert.doesNotThrow(() => assertLivePublishersAvailable(complet))

  // Sans la cle de service : aucune URL de media ne peut etre signee, donc
  // Instagram ne pourra JAMAIS publier (il refuse un post sans media).
  const sansCle = { ...complet, SUPABASE_SERVICE_ROLE_KEY: "" }
  assert.throws(
    () => assertLivePublishersAvailable(sansCle),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(msg.includes("SUPABASE_SERVICE_ROLE_KEY"))
      assert.ok(!msg.includes("OAUTH_META_CLIENT_ID"), "on ne cite pas ce qui est present")
      return true
    }
  )
})

test("live : une variable faite d'espaces est ABSENTE (une valeur vide dans Coolify)", () => {
  assert.throws(
    () =>
      assertLivePublishersAvailable({
        OAUTH_META_CLIENT_ID: "   ",
        OAUTH_META_CLIENT_SECRET: "b",
        OAUTH_TIKTOK_CLIENT_KEY: "c",
        OAUTH_TIKTOK_CLIENT_SECRET: "d",
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "f",
      }),
    /OAUTH_META_CLIENT_ID/
  )
})

test("loadConfig : DATABASE_URL et PUBLISHERS_MODE obligatoires, 6543 toujours refuse", () => {
  const saved = { ...process.env }
  try {
    process.env.DATABASE_URL = undefined
    delete process.env.DATABASE_URL
    delete process.env.PUBLISHERS_MODE
    assert.throws(() => loadConfig(), /DATABASE_URL manquant/)

    process.env.DATABASE_URL = REMOTE
    assert.throws(() => loadConfig(), /PUBLISHERS_MODE manquant/)

    // Regle 17 : le pooler transaction casse SKIP LOCKED et les advisory locks.
    process.env.DATABASE_URL = REMOTE.replace(":5432", ":6543")
    process.env.PUBLISHERS_MODE = "dry-run"
    assert.throws(() => loadConfig(), /6543/)

    process.env.DATABASE_URL = REMOTE
    const config = loadConfig()
    assert.equal(config.publishersMode, "dry-run")
    assert.equal(config.dryRunDeferMs, 15 * 60 * 1000)
  } finally {
    process.env = saved
  }
})
