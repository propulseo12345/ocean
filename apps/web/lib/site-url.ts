import "server-only"

import { headers } from "next/headers"

// Origine publique de l'app, résolue AU RUNTIME.
//
// ⚠️ Pourquoi `SITE_URL` et pas `NEXT_PUBLIC_SITE_URL` : Next inline les
// variables `NEXT_PUBLIC_*` **au build**, y compris dans le code serveur. Vérifié
// sur le bundle de ce dépôt — `apps/web/.next/server/**/*.js` ne contient plus
// une seule occurrence de `process.env.NEXT_PUBLIC_SITE_URL`, seulement la valeur
// gelée :
//     async function i(){ return "http://localhost:3000".replace(/\/$/,"") }
// Conséquences : (1) ce que Coolify pose au runtime est sans effet sur le code
// serveur ; (2) une image construite sur une machine de dev embarque `localhost`
// dans les liens d'emails et les redirect_uri OAuth. Une variable NON préfixée
// est, elle, lue à chaque requête.
//
// `NEXT_PUBLIC_SITE_URL` n'est volontairement plus lue côté serveur.

/** Origine configurée explicitement, normalisée (sans slash final). `null` si absente. */
export function configuredSiteOrigin(): string | null {
  const raw = process.env.SITE_URL?.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/**
 * Origine EXACTE et stable. À utiliser partout où l'URL est comparée octet à
 * octet par un tiers — typiquement le `redirect_uri` OAuth, que Meta, TikTok,
 * Google et Microsoft rejettent au moindre écart. Lève si `SITE_URL` est absente
 * ou invalide : mieux vaut une erreur nette qu'un `redirect_uri_mismatch` opaque
 * chez le fournisseur, ou pire, une URI dérivée d'un en-tête manipulable.
 */
export function requireSiteOrigin(): string {
  const origin = configuredSiteOrigin()
  if (!origin) {
    throw new Error(
      "SITE_URL manquant ou invalide. C'est l'origine publique de l'app " +
        "(ex. https://socean.54-36-180-115.sslip.io) ; elle doit correspondre EXACTEMENT " +
        "aux redirect URIs déclarées chez chaque fournisseur OAuth. Ne pas utiliser " +
        "NEXT_PUBLIC_SITE_URL : Next l'inline au build, la valeur du runtime serait ignorée."
    )
  }
  return origin
}

/**
 * Origine best-effort, pour les liens envoyés à un humain (emails, notifications).
 * `SITE_URL` d'abord, sinon les en-têtes du proxy — jamais d'échec, un lien
 * imparfait valant mieux qu'une notification perdue.
 */
export async function siteOrigin(): Promise<string> {
  const configured = configuredSiteOrigin()
  if (configured) return configured

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}
