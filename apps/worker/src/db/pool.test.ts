import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveSslConfig } from "./pool"

// Cette connexion lit vault.decrypted_secrets, donc les tokens OAuth en clair des
// comptes clients (règle 12). `rejectUnauthorized: false` acceptait n'importe quel
// certificat : un intermédiaire capable de se placer sur le chemin terminait le
// TLS et lisait les tokens. Ces tests interdisent le retour en arrière — il n'y a
// aucun chemin qui produise une connexion distante non vérifiée.

const REMOTE =
  "postgresql://postgres.hgdeopkmkwyoumsfggrm:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const PEM = "-----BEGIN CERTIFICATE-----\\nAAA\\n-----END CERTIFICATE-----"

function withEnv(value: string | undefined, fn: () => void): void {
  const saved = process.env.DATABASE_CA_CERT
  const savedPath = process.env.DATABASE_CA_CERT_PATH
  delete process.env.DATABASE_CA_CERT_PATH
  if (value === undefined) delete process.env.DATABASE_CA_CERT
  else process.env.DATABASE_CA_CERT = value
  try {
    fn()
  } finally {
    if (saved === undefined) delete process.env.DATABASE_CA_CERT
    else process.env.DATABASE_CA_CERT = saved
    if (savedPath !== undefined) process.env.DATABASE_CA_CERT_PATH = savedPath
  }
}

test("base distante + CA fournie : chaine verifiee", () => {
  withEnv(PEM, () => {
    const ssl = resolveSslConfig(REMOTE)
    assert.notEqual(ssl, false, "TLS obligatoire hors loopback")
    assert.equal(ssl && ssl.rejectUnauthorized, true)
    assert.ok(
      ssl && ssl.ca.includes("\n"),
      "les \\n litteraux des variables Coolify sont restitues"
    )
  })
})

test("base distante SANS CA : refus de demarrer, jamais de connexion non verifiee", () => {
  withEnv(undefined, () => {
    assert.throws(() => resolveSslConfig(REMOTE), /DATABASE_CA_CERT/)
  })
  withEnv("   ", () => {
    assert.throws(() => resolveSslConfig(REMOTE), /DATABASE_CA_CERT/)
  })
})

test("base locale : pas de TLS (le stack local n'en sert pas), CA inutile", () => {
  withEnv(undefined, () => {
    assert.equal(resolveSslConfig(LOCAL), false)
    assert.equal(resolveSslConfig("postgresql://u:p@localhost:5432/db"), false)
  })
})
