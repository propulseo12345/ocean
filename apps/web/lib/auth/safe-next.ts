// Destination de redirection après authentification (ticket P7-8).
//
// LA FAILLE
// ---------
// Deux endroits validaient `next` par un simple `startsWith("/")` :
// `signInWithPassword` (app/(auth)/actions.ts:43) et `/auth/callback`
// (app/auth/callback/route.ts:18). Or `//evil.tld` commence bien par « / » —
// c'est une URL *protocol-relative*, que le navigateur résout en
// `https://evil.tld`. La redirection partait donc d'un domaine authentique,
// APRÈS une connexion réussie : le contexte idéal pour un hameçonnage
// (l'utilisateur vient de taper son mot de passe, il fait confiance à ce qui
// s'affiche ensuite). `/\evil.tld` a le même effet — les navigateurs traitent la
// barre inverse comme une barre dans l'autorité d'une URL.
//
// LA RÈGLE
// --------
// On n'essaie pas d'énumérer les formes dangereuses : on résout la valeur contre
// une origine sentinelle et on exige que l'origine obtenue soit EXACTEMENT
// celle-là. Tout ce qui s'en échappe est rejeté, quelle que soit l'astuce
// d'encodage. Le chemin est ensuite reconstruit à partir de l'URL analysée,
// jamais recopié tel quel.
//
// POURQUOI VALIDER LA SORTIE AUSSI
// --------------------------------
// La première version ne testait le motif protocol-relative que sur l'ENTRÉE,
// donc du mauvais côté du parser — et c'est le parser qui fabrique la chaîne
// interdite. `/..//evil.tld` n'a qu'une barre en tête : il passe la garde
// d'entrée. Le parser WHATWG replie ensuite le segment `..` contre un chemin
// vide (sans effet) puis empile le segment VIDE situé entre les deux barres, et
// `url.pathname` vaut `//evil.tld`. Le juge d'origine ne voit rien : l'hôte a
// été fixé par la base AVANT l'analyse du chemin, `url.origin` vaut toujours la
// sentinelle. La fonction renvoyait donc exactement la chaîne qu'elle existe
// pour refuser (`/.//evil.tld` et `/%2e%2e//evil.tld` de même).
//
// La garde n'est donc pas sur l'entrée mais sur la SORTIE : on re-résout la
// chaîne que l'on s'apprête à rendre, et on exige à nouveau la sentinelle.
// C'est le même principe appliqué au bon endroit — pas une énumération de plus.
// Interdire `..` en entrée serait un correctif inopérant : `/.//evil.tld` n'en
// contient pas.

/** Origine sentinelle : le TLD `.invalid` est réservé, il ne résout jamais. */
const SENTINELLE = "https://ocean.invalid"

/** Destination par défaut quand `next` est absent, invalide ou hostile. */
export const DEFAULT_NEXT = "/dashboard"

/** Caractères de contrôle : certains agents les suppriment AVANT de résoudre
 *  l’URL, ce qui permet de reconstituer `//evil.tld` depuis un `next` qui
 *  contient un saut de ligne ou un NUL. */
function contientControle(valeur: string): boolean {
  for (let i = 0; i < valeur.length; i++) {
    const code = valeur.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** `//evil.tld` et `/\evil.tld` : commencent par « / », désignent un autre hôte. */
const PROTOCOL_RELATIVE = /^[/\\]{2,}/

/**
 * Normalise une destination de redirection interne.
 *
 * Renvoie toujours un chemin relatif sûr, commençant par « / » et visant la même
 * origine. `fallback` est utilisé dès que la valeur n'est pas exploitable.
 */
export function safeNext(candidate: unknown, fallback: string = DEFAULT_NEXT): string {
  if (typeof candidate !== "string") return fallback

  const raw = candidate.trim()
  if (!raw.startsWith("/")) return fallback
  if (contientControle(candidate)) return fallback
  if (PROTOCOL_RELATIVE.test(raw)) return fallback

  let url: URL
  try {
    url = new URL(raw, SENTINELLE)
  } catch {
    return fallback
  }

  // Premier juge : tout ce qui a changé d'origine à l'analyse est hostile.
  if (url.origin !== SENTINELLE) return fallback

  // Reconstruit depuis l'URL analysée — jamais la chaîne d'entrée.
  const sortie = `${url.pathname}${url.search}${url.hash}`

  // Second juge, et c'est lui qui compte : le parser a pu FABRIQUER une
  // autorité (`//evil.tld`) à partir d'une entrée qui n'en portait pas. On
  // soumet la sortie exactement au traitement que lui appliquera le navigateur.
  if (PROTOCOL_RELATIVE.test(sortie)) return fallback
  let verif: URL
  try {
    verif = new URL(sortie, SENTINELLE)
  } catch {
    return fallback
  }
  if (verif.origin !== SENTINELLE) return fallback

  return sortie
}
