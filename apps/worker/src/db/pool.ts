import fs from "node:fs"
import pg from "pg"
import { isLocalDatabaseUrl, type WorkerConfig } from "../env"

// Pool Postgres du worker. Connexion Supavisor mode SESSION (port 5432) —
// impératif pour FOR UPDATE SKIP LOCKED entre commandes et les advisory locks
// (le pooler transaction 6543 les casse, règle 17). Peu de connexions, longues.
//
// C'est la connexion qui lit `vault.decrypted_secrets`, donc les tokens OAuth en
// clair des comptes clients (règle 12). Elle vérifie donc la chaîne de
// certification : `rejectUnauthorized: true` fait, côté Node, ce que libpq appelle
// `verify-full` (validation de la chaîne ET du nom d'hôte, via le
// checkServerIdentity par défaut). Auparavant `rejectUnauthorized: false` :
// n'importe quel intermédiaire capable de se placer sur le chemin pouvait
// terminer le TLS et lire ces tokens.
//
// ⚠️ Supabase signe ses endpoints Postgres avec SA PROPRE autorité, pas une
// autorité publique — vérifié par handshake le 14/08/2026 sur
// aws-0-eu-west-1.pooler.supabase.com ET db.<ref>.supabase.co : la chaîne remonte
// à « Supabase Root 2021 CA », absente du magasin de confiance de Node. La
// vérification ne peut donc PAS fonctionner sans fournir ce certificat racine.
// D'où DATABASE_CA_CERT / DATABASE_CA_CERT_PATH, obligatoires hors loopback.

/**
 * Racine de confiance supplémentaire (Supabase Root 2021 CA). Deux formes :
 * un chemin de fichier, ou le PEM directement — les variables d'environnement
 * Coolify passant souvent les sauts de ligne en littéral `\n`.
 */
function loadExtraCa(): string | undefined {
  const path = process.env.DATABASE_CA_CERT_PATH
  if (path) return fs.readFileSync(path, "utf8")
  const inline = process.env.DATABASE_CA_CERT
  if (inline?.trim()) return inline.replace(/\\n/g, "\n")
  return undefined
}

export type SslConfig = false | { rejectUnauthorized: true; ca: string }

/**
 * TLS exigé et vérifié dès que la base n'est pas le loopback. Aucun repli sur une
 * connexion non vérifiée : sans certificat racine, on refuse de démarrer plutôt
 * que d'accepter n'importe quel certificat sur la connexion qui lit le Vault.
 */
export function resolveSslConfig(databaseUrl: string): SslConfig {
  if (isLocalDatabaseUrl(databaseUrl)) return false
  const ca = loadExtraCa()
  if (!ca) {
    throw new Error(
      "DATABASE_CA_CERT (ou DATABASE_CA_CERT_PATH) manquant. Cette connexion lit les " +
        "tokens OAuth des clients dans le Vault : elle vérifie la chaîne de certification, " +
        "et Supabase signe avec sa propre autorité (« Supabase Root 2021 CA »), absente du " +
        "magasin de Node. Télécharger prod-ca-2021.crt dans Supabase > Project Settings > " +
        "Database > SSL Configuration et le poser dans l'environnement du worker. " +
        "Empreinte SHA-256 attendue de la racine : " +
        "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA"
    )
  }
  return { rejectUnauthorized: true, ca }
}

export function createPool(config: WorkerConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: resolveSslConfig(config.databaseUrl),
  })
}
