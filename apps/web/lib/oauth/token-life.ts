// Durée de vie des tokens : quand rafraîchir, et quand il est trop tard.
//
// Module PUR (aucun `server-only`, aucun réseau) : les seuils sont donc exécutés
// par les tests. C'est voulu — ce sont des décisions à conséquence lourde et
// silencieuse. Un token Meta non rafraîchi à temps est **définitivement perdu** :
// il n'y a pas de refresh token côté Meta, seulement un échange qui exige un
// token encore valide. Passé l'échéance, le client doit tout reconnecter.

/** Un jour, en millisecondes. */
const JOUR = 24 * 60 * 60 * 1000

/**
 * Durée nominale d'un token long-lived Meta : 60 jours.
 * (`fb_exchange_token` renvoie ~5 183 944 s.)
 */
export const META_LONG_LIVED_DAYS = 60

/**
 * Marge avant échéance en dessous de laquelle on rafraîchit (CLAUDE.md §5).
 *
 * 10 jours, et la marge est large **exprès** : le rafraîchissement Meta n'a pas
 * de filet. S'il échoue — panne réseau, worker arrêté, quota — il faut qu'il
 * reste assez de temps pour réessayer les jours suivants, et pour qu'un humain
 * soit prévenu et agisse. Une marge d'un jour ferait dépendre la connexion d'un
 * seul tick réussi.
 */
export const REFRESH_MARGIN_DAYS = 10

export type TokenHealth = "ok" | "a_rafraichir" | "expire" | "inconnu"

/**
 * État d'un token d'après sa date d'échéance.
 *
 * `inconnu` n'est pas `ok` : une échéance absente veut dire qu'on ne sait pas,
 * et le traiter comme saine, c'est promettre une publication qu'on ne peut pas
 * tenir. Les appelants décident quoi en faire — mais ils doivent le décider.
 */
export function tokenHealth(
  expiresAt: string | Date | null | undefined,
  nowMs: number,
  marginDays: number = REFRESH_MARGIN_DAYS
): TokenHealth {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") return "inconnu"
  const échéance = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt)
  if (!Number.isFinite(échéance)) return "inconnu"
  if (échéance <= nowMs) return "expire"
  if (échéance - nowMs <= marginDays * JOUR) return "a_rafraichir"
  return "ok"
}

/** Faut-il tenter un rafraîchissement maintenant ? */
export function shouldRefresh(
  expiresAt: string | Date | null | undefined,
  nowMs: number,
  marginDays: number = REFRESH_MARGIN_DAYS
): boolean {
  const état = tokenHealth(expiresAt, nowMs, marginDays)
  // `expire` est inclus : une tentative peut encore aboutir chez les
  // fournisseurs à refresh token (TikTok, Microsoft). Chez Meta elle échouera,
  // et cet échec est précisément ce qui doit poser `needs_reauth`.
  return état === "a_rafraichir" || état === "expire"
}

/** Échéance ISO à partir d'une durée en secondes, ou `null` si non fournie. */
export function expiryFromSeconds(seconds: number | undefined, nowMs: number): string | null {
  if (!seconds || seconds <= 0) return null
  return new Date(nowMs + seconds * 1000).toISOString()
}

/**
 * Un token Meta fraîchement échangé a-t-il bien une durée « longue » ?
 *
 * Sert de garde-fou au retour de `fb_exchange_token` : si le fournisseur renvoie
 * une durée courte (ou aucune), c'est que l'échange n'a pas eu lieu comme prévu,
 * et publier là-dessus donnerait un token mort dans l'heure.
 */
export function looksLongLived(expiresInSeconds: number | undefined): boolean {
  if (!expiresInSeconds) return false
  // Seuil bas volontairement prudent : un token long-lived Meta vaut ~60 jours,
  // un short-lived ~1 à 2 heures. Tout ce qui dépasse une semaine est « long ».
  return expiresInSeconds >= 7 * 24 * 60 * 60
}
