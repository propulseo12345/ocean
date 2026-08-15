import assert from "node:assert/strict"
import { test } from "node:test"

import { DEFAULT_NEXT, safeNext, safeNextFromRedirectTo } from "./safe-next"

// Ticket P7-8 — open redirect sur `next`.
//
// L'ancienne validation tenait en `next.startsWith("/")`. Elle laissait passer
// `//evil.tld`, que le navigateur résout en `https://evil.tld` : redirection
// hors domaine, depuis une origine authentique et APRÈS une connexion réussie.
//
// POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT
// ---------------------------------
// Sa version précédente comptait 8 tests verts qui certifiaient un filtre
// inopérant. Le dernier portait la BONNE assertion (« la sortie ne commence
// jamais par // ») mais sur une liste de 7 entrées choisies à la main, toutes
// déjà tuées par les gardes d'entrée, et AUCUNE ne contenait de dot-segment :
// l'assertion ne pouvait pas se déclencher. C'était une énumération déguisée en
// invariant. Le fichier contenait de surcroît un octet NUL, ce qui le faisait
// classer en binaire par git : `git show` n'affichait rien, et le test qui
// certifiait un correctif de sécurité était invisible en revue de code.
//
// On ne teste donc plus une liste : on génère un corpus hostile par combinaison
// et on vérifie une PROPRIÉTÉ. Une liste ne prouve rien sur les cas qu'elle
// n'énumère pas — et c'est précisément un cas non énuméré qui est passé.

/** Origines de contrôle, distinctes de la sentinelle interne du module. */
const ORIGINES = ["https://ocean.example", "https://socean.54-36-180-115.sslip.io"]

// --- Génération du corpus ---------------------------------------------------

/** Séquences de repli de chemin : c'est le parser qui les transforme. */
const REPLIS = [
  "",
  "..",
  ".",
  "../..",
  "./.",
  "%2e%2e",
  "%2E%2E",
  "%2e",
  ".%2e",
  "%2e.",
  "..%2f..",
  "....",
  "..;",
]

/** Ce qui sépare le repli de l'hôte convoité. */
const SEPARATEURS = ["/", "//", "///", "////", "/\\", "\\/", "\\\\", "%2f%2f", "/%2f", "%5c%5c"]

/** Têtes plausibles : une destination réelle de l'application, ou la racine. */
const TETES = ["/", "/dashboard/", "/clients/123/", "/portal/", "/a/"]

/** Cibles externes convoitées. */
const HOTES = ["evil.tld", "user:pass@evil.tld", "evil.tld:8443", "localhost", "127.0.0.1"]

/** Suffixes : la query et le fragment font partie de la chaîne rendue. */
const SUFFIXES = ["", "?x=1", "#y", "?x=1#y"]

function corpusGenere(): string[] {
  const out: string[] = []
  for (const tete of TETES) {
    for (const repli of REPLIS) {
      for (const sep of SEPARATEURS) {
        for (const hote of HOTES) {
          out.push(`${tete}${repli}${sep}${hote}`)
          for (const suf of SUFFIXES) if (suf) out.push(`${tete}${repli}${sep}${hote}${suf}`)
        }
      }
    }
  }
  return out
}

/** Classes hostiles qui ne se génèrent pas par combinaison de chemins. */
const CORPUS_FIXE: string[] = [
  // Caractères de contrôle — certains agents les suppriment AVANT de résoudre.
  "/\0//evil.tld",
  "/\0/evil.tld",
  "/\n//evil.tld",
  "/\r\n//evil.tld",
  "/\t//evil.tld",
  "/\v//evil.tld",
  "/\f//evil.tld",
  "/dashboard\r\nSet-Cookie: x=1",
  "///evil.tld",
  // Espaces et bornes.
  "/ //evil.tld",
  "  //evil.tld  ",
  "",
  "   ",
  "/",
  // Schémas.
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "java\tscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "https://evil.tld",
  "http://evil.tld",
  "//evil.tld",
  "https:/\\evil.tld",
  // Autorité par arobase.
  "/@evil.tld",
  "/..//@evil.tld",
  "@evil.tld",
  // Sans barre initiale.
  "dashboard",
  "evil.tld",
  "\\\\evil.tld",
]

/** Destinations internes qui doivent survivre intactes. */
const LEGITIMES = [
  "/dashboard",
  "/portal",
  "/clients/123/content?tab=grid",
  "/api/invitations/accept?token=abc.def-ghi",
  "/reset-password?next=%2Fportal",
  "/dashboard#section",
]

const CORPUS = [...corpusGenere(), ...CORPUS_FIXE, ...LEGITIMES]

// --- Le corpus mord-il ? ----------------------------------------------------

test("le corpus contient bien les formes qui s echappaient (garde anti-corpus-mou)", () => {
  // Sans cette garde, quelqu'un peut « nettoyer » les générateurs et retomber
  // sur un corpus qui ne contient plus que des cas déjà fermés : la propriété
  // redeviendrait verte et vide de sens, exactement comme la version d'avant.
  for (const echappe of [
    "/..//evil.tld",
    "/.//evil.tld",
    "/%2e%2e//evil.tld",
    "/dashboard/../..//evil.tld",
    "/..//evil.tld?x=1#y",
  ]) {
    assert.ok(CORPUS.includes(echappe), `le corpus doit contenir ${JSON.stringify(echappe)}`)
  }
  assert.ok(CORPUS.length > 500, `corpus trop maigre : ${CORPUS.length}`)
})

test("les formes qui s echappaient sont refusees — la regression P7-8", () => {
  // Ces cinq chaînes renvoyaient littéralement `//evil.tld` avant le correctif.
  // Ce test échoue sur la version précédente du module : c'est sa raison d'être.
  for (const echappe of [
    "/..//evil.tld",
    "/.//evil.tld",
    "/%2e%2e//evil.tld",
    "/dashboard/../..//evil.tld",
    "/..//evil.tld?x=1#y",
  ]) {
    assert.equal(safeNext(echappe), DEFAULT_NEXT, `doit etre rejete : ${echappe}`)
  }
})

// --- La propriété -----------------------------------------------------------

test("PROPRIETE : la sortie ne quitte JAMAIS l origine, quelle que soit l entree", () => {
  for (const entree of CORPUS) {
    const sortie = safeNext(entree)

    // 1. La sortie est un chemin absolu interne.
    assert.ok(sortie.startsWith("/"), `${JSON.stringify(entree)} -> ${JSON.stringify(sortie)}`)
    assert.ok(
      !/^[/\\]{2,}/.test(sortie),
      `autorite fabriquee : ${JSON.stringify(entree)} -> ${JSON.stringify(sortie)}`
    )

    // 2. Consommée telle quelle par `redirect()` — le puits de `(auth)/actions.ts`.
    //    C'est le scénario réel : le navigateur résout la valeur contre l'origine
    //    courante. Elle doit y rester.
    for (const origine of ORIGINES) {
      assert.equal(
        new URL(sortie, origine).origin,
        origine,
        `fuite hors origine : ${JSON.stringify(entree)} -> ${JSON.stringify(sortie)}`
      )
    }

    // 3. Consommée par concaténation — le motif de `/auth/callback` et
    //    `/auth/landing` (`${origin}${next}`). Voir le test dédié plus bas.
    for (const origine of ORIGINES) {
      assert.equal(
        new URL(`${origine}${sortie}`).origin,
        origine,
        `fuite par concatenation : ${JSON.stringify(entree)} -> ${JSON.stringify(sortie)}`
      )
    }
  }
})

test("PROPRIETE : le fallback est rendu tel quel et reste interne", () => {
  for (const entree of CORPUS) {
    const sortie = safeNext(entree, "/portal")
    assert.ok(sortie.startsWith("/"), `${JSON.stringify(entree)} -> ${sortie}`)
    for (const origine of ORIGINES) {
      assert.equal(new URL(sortie, origine).origin, origine, `${JSON.stringify(entree)}`)
    }
  }
})

// --- Les deux modes de consommation -----------------------------------------

test("les DEUX motifs de consommation sont sûrs — a ne pas « simplifier »", () => {
  // `app/auth/callback/route.ts:25,28` et `app/auth/landing/route.ts:23` font
  // `NextResponse.redirect(`${origin}${next}`)`. Cette concaténation les
  // protégeait PAR ACCIDENT quand `safeNext` laissait sortir `//evil.tld` :
  // `https://app` + `//evil.tld` garde l'hôte de l'app, alors que le `redirect()`
  // nu de `(auth)/actions.ts:49,191` partait chez l'attaquant.
  //
  // Ce test fige la différence pour que personne ne la « nettoie » sans le
  // savoir : depuis le correctif, les DEUX motifs sont sûrs, donc remplacer une
  // concaténation par `NextResponse.redirect(next)` est désormais sans danger —
  // et si quelqu'un régresse `safeNext`, c'est ici que ça casse d'abord.
  const origine = "https://socean.54-36-180-115.sslip.io"
  for (const entree of ["/..//evil.tld", "//evil.tld", "/dashboard/../..//evil.tld"]) {
    const next = safeNext(entree)
    assert.equal(new URL(`${origine}${next}`).origin, origine, `concatenation : ${entree}`)
    assert.equal(new URL(next, origine).origin, origine, `redirect nu : ${entree}`)
  }
})

// --- Les cas nominaux -------------------------------------------------------

test("les destinations internes legitimes passent, inchangees", () => {
  for (const bon of LEGITIMES) {
    assert.equal(safeNext(bon), bon, bon)
  }
})

test("valeurs absentes ou du mauvais type => destination par defaut", () => {
  for (const vide of [null, undefined, "", "   ", 42, {}, [], true]) {
    assert.equal(safeNext(vide), DEFAULT_NEXT, JSON.stringify(vide))
  }
})

test("un chemin relatif sans barre initiale est refuse (il pourrait etre un hote)", () => {
  assert.equal(safeNext("dashboard"), DEFAULT_NEXT)
  assert.equal(safeNext("evil.tld"), DEFAULT_NEXT)
})

test("le fallback est respecte — le portail pour un reviewer", () => {
  assert.equal(safeNext("//evil.tld", "/portal"), "/portal")
  assert.equal(safeNext("/..//evil.tld", "/portal"), "/portal")
  assert.equal(safeNext(null, "/portal"), "/portal")
  assert.equal(safeNext("/clients", "/portal"), "/clients")
})

// --- safeNextFromRedirectTo (V-2) -------------------------------------------
//
// Le gabarit d'e-mail Supabase transmet `next={{ .RedirectTo }}`, qui est une
// URL ABSOLUE. `safeNext` la refusait et retombait sur le fallback : le jeton
// d'invitation etait perdu a ce hop precis, ce qui est l'une des deux impasses
// du flux d'invitation.

const NOTRE_ORIGINE = "https://socean.54-36-180-115.sslip.io"

test("une absolue sur NOTRE origine est reduite a son chemin", () => {
  assert.equal(
    safeNextFromRedirectTo(`${NOTRE_ORIGINE}/invitations?token=abc.def`, NOTRE_ORIGINE),
    "/invitations?token=abc.def"
  )
  assert.equal(safeNextFromRedirectTo(`${NOTRE_ORIGINE}/portal`, NOTRE_ORIGINE), "/portal")
  // Un chemin relatif reste traite exactement comme avant.
  assert.equal(safeNextFromRedirectTo("/dashboard", NOTRE_ORIGINE), "/dashboard")
})

test("une absolue sur une AUTRE origine est refusee (hote, schema, port)", () => {
  for (const hostile of [
    "https://evil.tld/x",
    "http://socean.54-36-180-115.sslip.io/x", // schema different
    "https://socean.54-36-180-115.sslip.io:8443/x", // port different
    "https://socean.54-36-180-115.sslip.io.evil.tld/x", // suffixe : le piege du startsWith
    "https://user:pass@evil.tld/x",
    "javascript:alert(1)",
    "//evil.tld",
  ]) {
    assert.equal(safeNextFromRedirectTo(hostile, NOTRE_ORIGINE), DEFAULT_NEXT, hostile)
  }
})

test("PROPRIETE : safeNextFromRedirectTo ne quitte pas davantage l origine", () => {
  // Le meme corpus hostile, plus sa variante prefixee de notre origine : la
  // tolerance ajoutee ne doit ouvrir aucune sortie que safeNext fermait.
  for (const entree of CORPUS) {
    for (const variante of [entree, `${NOTRE_ORIGINE}${entree}`]) {
      const sortie = safeNextFromRedirectTo(variante, NOTRE_ORIGINE)
      assert.ok(sortie.startsWith("/"), `${JSON.stringify(variante)} -> ${JSON.stringify(sortie)}`)
      assert.ok(
        !/^[/\\]{2,}/.test(sortie),
        `autorite fabriquee : ${JSON.stringify(variante)} -> ${JSON.stringify(sortie)}`
      )
      for (const origine of ORIGINES) {
        assert.equal(
          new URL(sortie, origine).origin,
          origine,
          `fuite hors origine : ${JSON.stringify(variante)} -> ${JSON.stringify(sortie)}`
        )
      }
    }
  }
})
