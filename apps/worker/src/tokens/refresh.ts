import type pg from "pg"

// Rotation/refresh d'un token OAuth sous ADVISORY LOCK par compte (règle 14). La
// rotation TikTok/Microsoft REMPLACE le refresh token à chaque échange : deux
// refresh concurrents sur le même compte en perdraient un (compte cassé). Le lock
// transactionnel sérialise par compte et se libère au commit/rollback.
//
// SCAFFOLD (mode réel uniquement — les publishers stub n'utilisent pas de token) :
// la lecture/écriture Vault se fait ici, jamais de token en clair ailleurs.

/**
 * Exécute `fn` en détenant le verrou du compte. Le verrou est transactionnel
 * (pg_advisory_xact_lock) : impossible d'oublier de le relâcher.
 */
export async function withAccountLock<T>(
  pool: pg.Pool,
  accountKey: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [accountKey])
    const out = await fn(client)
    await client.query("commit")
    return out
  } catch (err) {
    await client.query("rollback")
    throw err
  } finally {
    client.release()
  }
}

// Flux réel à brancher quand les creds seront actives :
//   1. withAccountLock(pool, connectionId, async (c) => {
//        - relire l'expiry depuis platform_connection_secrets
//        - si > seuil (Meta: <10j ; TikTok: avant chaque job) => POST token endpoint
//        - écrire le nouveau secret via vault.update_secret(secret_id, new_token)
//          (le worker est postgres => accès direct au schéma vault)
//        - maj token_expires_at / refresh_token_expires_at
//      })
//   2. échec refresh => status='needs_reauth' + email Brevo 'needs-reauth' (règle 14).
