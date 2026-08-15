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

  // Le juge final : tout ce qui a changé d'origine est hostile.
  if (url.origin !== SENTINELLE) return fallback

  // Reconstruit depuis l'URL analysée — jamais la chaîne d'entrée.
  return `${url.pathname}${url.search}${url.hash}`
}
