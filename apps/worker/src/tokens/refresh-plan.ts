// Décisions de rafraîchissement de token — la moitié PURE, donc testée.
//
// Le reste (`refresh.ts`) tient le verrou et parle au réseau. Ici, seulement
// « faut-il rafraîchir ? » et « a-t-on le droit d'écrire ce résultat ? ».

/** Un jour, en millisecondes. */
const JOUR = 24 * 60 * 60 * 1000

/**
 * Marge avant échéance déclenchant un rafraîchissement (CLAUDE.md §5 : Meta
 * long-lived 60 j, rafraîchir si < 10 j — non rafraîchi = perdu).
 *
 * ⚠ Doublon assumé avec `apps/web/lib/oauth/token-life.ts`. Les deux paquets ne
 * partagent aucun module (`packages/shared` ne porte que des types DB), et
 * importer du web dans le worker créerait une dépendance qui n'existe pas dans
 * l'image Docker du worker. Le chiffre est le même et le commentaire le dit des
 * deux côtés : une divergence future sera visible, pas silencieuse.
 */
export const REFRESH_MARGIN_DAYS = 10

export type RefreshAction =
  | { action: "skip"; reason: "pas_echu" | "pas_de_refresh_token" }
  | { action: "refresh" }
  | { action: "needs_reauth"; reason: "refresh_token_expire" | "aucun_moyen" }

export interface RefreshInputs {
  /** Échéance de l'access token. `null` = inconnue. */
  tokenExpiresAt: string | null
  /** Échéance du refresh token (TikTok, Microsoft). `null` = pas d'échéance connue. */
  refreshTokenExpiresAt: string | null
  /** Y a-t-il un refresh token stocké ? */
  hasRefreshToken: boolean
  /**
   * Le fournisseur sait-il rafraîchir sans intervention humaine ?
   * Meta : non — il « ré-échange » un token encore valide. Passé l'échéance,
   * plus rien n'est possible sans reconnexion.
   */
  canSelfRefresh: boolean
  nowMs: number
  marginDays?: number
}

/**
 * Que faire de ce compte, maintenant ?
 *
 * L'ordre des tests est le fond du sujet. On regarde d'abord ce qui rend le
 * rafraîchissement IMPOSSIBLE (refresh token périmé, aucun moyen), et seulement
 * ensuite s'il est nécessaire. L'ordre inverse ferait tenter un échange voué à
 * l'échec, puis conclurait « erreur réseau » là où la vraie réponse est
 * « demande à l'utilisateur de se reconnecter ».
 */
export function decideRefresh(inputs: RefreshInputs): RefreshAction {
  const marge = (inputs.marginDays ?? REFRESH_MARGIN_DAYS) * JOUR
  const échéance = parseDate(inputs.tokenExpiresAt)
  const échéanceRefresh = parseDate(inputs.refreshTokenExpiresAt)

  // Le refresh token lui-même est mort : aucun échange ne peut aboutir.
  if (inputs.hasRefreshToken && échéanceRefresh !== null && échéanceRefresh <= inputs.nowMs) {
    return { action: "needs_reauth", reason: "refresh_token_expire" }
  }

  // Échéance inconnue : on ne tente rien à l'aveugle. Un échange inutile chez un
  // fournisseur à rotation CONSOMME le refresh token — le déclencher sans raison
  // casserait un compte parfaitement sain.
  if (échéance === null) return { action: "skip", reason: "pas_echu" }

  const doitAgir = échéance - inputs.nowMs <= marge
  if (!doitAgir) return { action: "skip", reason: "pas_echu" }

  // Meta n'a pas de refresh token : il ré-échange un token ENCORE VALIDE. Une
  // fois l'échéance passée, il n'existe plus aucun chemin automatique.
  if (!inputs.canSelfRefresh && !inputs.hasRefreshToken) {
    if (échéance <= inputs.nowMs) return { action: "needs_reauth", reason: "aucun_moyen" }
    return { action: "refresh" }
  }

  if (!inputs.hasRefreshToken) return { action: "skip", reason: "pas_de_refresh_token" }
  return { action: "refresh" }
}

function parseDate(value: string | null): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/**
 * A-t-on le droit d'écrire le résultat d'un échange fait HORS VERROU ?
 *
 * C'est le compare-and-swap qui rend l'appel hors verrou sûr. Entre la lecture
 * et l'écriture, un autre worker a pu rafraîchir le même compte. Chez un
 * fournisseur à ROTATION (TikTok, Microsoft), son échange a invalidé le refresh
 * token que nous avions lu : écrire notre résultat par-dessus le sien
 * remplacerait un token valide par un token déjà mort — le compte serait cassé,
 * et personne ne saurait pourquoi.
 *
 * La clé de comparaison est le refresh token OBSERVÉ au moment de la lecture :
 * c'est exactement ce qui change lors d'une rotation concurrente.
 */
export function peutEcrireResultat(
  observéALaLecture: string | null,
  actuelEnBase: string | null
): boolean {
  return observéALaLecture === actuelEnBase
}
