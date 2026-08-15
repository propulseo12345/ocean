import assert from "node:assert/strict"
import test from "node:test"

import { OAUTH_PROVIDERS } from "./config"
import {
  expiryFromSeconds,
  looksLongLived,
  META_LONG_LIVED_DAYS,
  REFRESH_MARGIN_DAYS,
  shouldRefresh,
  tokenHealth,
} from "./token-life"

const JOUR = 24 * 60 * 60 * 1000
const T0 = 1_760_000_000_000
const dans = (jours: number) => new Date(T0 + jours * JOUR).toISOString()

test("PROPRIÉTÉ : la santé d'un token est monotone dans le temps", () => {
  // Un token ne peut pas redevenir sain en vieillissant. Une liste de cas
  // n'aurait vérifié que les trois bornes auxquelles on a pensé.
  const ordre = { ok: 3, a_rafraichir: 2, expire: 1, inconnu: 0 }
  const échéance = dans(META_LONG_LIVED_DAYS)
  let précédent = 4
  for (let j = 0; j <= META_LONG_LIVED_DAYS + 5; j++) {
    const état = tokenHealth(échéance, T0 + j * JOUR)
    assert.ok(
      ordre[état] <= précédent,
      `à J+${j} l'état remonte de ${précédent} à ${ordre[état]} (${état})`
    )
    précédent = ordre[état]
  }
})

test("les trois bornes de la fenêtre de rafraîchissement", () => {
  // Loin de l'échéance : rien à faire.
  assert.equal(tokenHealth(dans(60), T0), "ok")
  // Juste au-dessus de la marge : encore ok.
  assert.equal(tokenHealth(dans(REFRESH_MARGIN_DAYS + 0.5), T0), "ok")
  // Dans la marge : à rafraîchir.
  assert.equal(tokenHealth(dans(REFRESH_MARGIN_DAYS), T0), "a_rafraichir")
  assert.equal(tokenHealth(dans(1), T0), "a_rafraichir")
  // Échu.
  assert.equal(tokenHealth(dans(0), T0), "expire")
  assert.equal(tokenHealth(dans(-1), T0), "expire")
})

test("une échéance ABSENTE ou illisible est `inconnu`, jamais `ok`", () => {
  // Le repli dangereux serait de considérer « pas de date = tout va bien » :
  // on promettrait une publication sans rien savoir du token.
  for (const valeur of [null, undefined, "", "pas-une-date", "2026-13-45"]) {
    assert.equal(tokenHealth(valeur, T0), "inconnu", `«${String(valeur)}» n'est pas inconnu`)
  }
  assert.notEqual(tokenHealth(null, T0), "ok")
})

test("shouldRefresh couvre AUSSI le token déjà expiré", () => {
  // Chez TikTok/Microsoft une tentative peut encore aboutir. Chez Meta elle
  // échouera — et c'est cet échec qui doit poser `needs_reauth`, pas un silence.
  assert.equal(shouldRefresh(dans(60), T0), false)
  assert.equal(shouldRefresh(dans(REFRESH_MARGIN_DAYS - 1), T0), true)
  assert.equal(shouldRefresh(dans(-3), T0), true)
  // Inconnu : on ne tente rien à l'aveugle, l'appelant doit trancher.
  assert.equal(shouldRefresh(null, T0), false)
})

test("la marge est LARGE exprès : plusieurs jours de tentatives avant la perte", () => {
  // Un token Meta non rafraîchi à temps est définitivement perdu (aucun refresh
  // token). Une marge d'un jour ferait dépendre la connexion d'un seul tick.
  assert.ok(REFRESH_MARGIN_DAYS >= 7, "marge trop courte pour absorber une panne")
  assert.ok(
    REFRESH_MARGIN_DAYS < META_LONG_LIVED_DAYS / 2,
    "marge si large qu'on rafraîchit sans cesse"
  )
})

test("expiryFromSeconds : une durée absente ou nulle ne fabrique pas d'échéance", () => {
  assert.equal(expiryFromSeconds(undefined, T0), null)
  assert.equal(expiryFromSeconds(0, T0), null)
  assert.equal(expiryFromSeconds(-5, T0), null)
  assert.equal(expiryFromSeconds(3600, T0), new Date(T0 + 3_600_000).toISOString())
})

test("looksLongLived distingue un vrai 60 jours d'un token court", () => {
  // Garde-fou au retour de `fb_exchange_token` : si Meta rend une durée courte,
  // l'échange n'a pas eu lieu comme prévu et les tokens de page mourront vite.
  assert.equal(looksLongLived(5_183_944), true) // ~60 j, valeur réelle Meta
  assert.equal(looksLongLived(3600), false) // 1 h = short-lived
  assert.equal(looksLongLived(7200), false)
  assert.equal(looksLongLived(undefined), false)
  assert.equal(looksLongLived(0), false)
})

test("LE TICKET : seul Meta réclame l'échange long-lived", () => {
  // Les trois autres émettent un refresh token ; leur appliquer
  // `fb_exchange_token` produirait une erreur à chaque connexion.
  assert.equal(OAUTH_PROVIDERS.meta.needsLongLivedExchange, true)
  for (const clé of ["tiktok", "google", "microsoft"] as const) {
    assert.equal(OAUTH_PROVIDERS[clé].needsLongLivedExchange, false, `${clé} ne doit pas échanger`)
  }
})
