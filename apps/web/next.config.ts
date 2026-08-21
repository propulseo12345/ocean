import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const here = path.dirname(fileURLToPath(import.meta.url))

// Hôtes autorisés pour l'optimiseur d'images (`next/image`).
//
// AVANT : `images.pexels.com` seul — vestige de la phase mock, alors que 17
// composants passent à `next/image` des URL Supabase Storage (`media.thumbUrl`
// via getPublicUrl, `current.fullUrl` via createSignedUrls, la médiathèque).
// En production, l'optimiseur ne « plante » pas : il répond 400
// `"url" parameter is not allowed`. Donc pas de crash, mais AUCUNE image —
// médiathèque, grille, studio et portail vides. Un outil de gestion de contenu
// visuel dont aucune image ne s'affiche est inutilisable.
//
// ⚠ LE PIÈGE : `remotePatterns` est résolu AU BUILD. Une valeur lue ici depuis
// `process.env` est donc figée dans l'image Docker — et dans le build du
// conteneur, `NEXT_PUBLIC_SUPABASE_URL` n'est PAS fournie (le Dockerfile ne
// passait aucun build arg). Dériver naïvement le hostname de l'URL Supabase
// aurait produit une liste VIDE en production : exactement le bug qu'on corrige,
// mais plus difficile à voir, parce que ça marche en local.
//
// D'où les deux niveaux ci-dessous. Le Dockerfile passe désormais `SUPABASE_URL`
// en `ARG`, ce qui donne le motif exact ; s'il manque, on retombe sur le
// caractère générique `*.supabase.co`, qui reste correct pour tout projet
// Supabase. Le `pathname` borne le tout au chemin des objets Storage.
//
// `search` est volontairement NON spécifié : les URL signées de `media-originals`
// portent leur jeton en query string, et `search: ''` les rejetterait toutes.
function supabaseStoragePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const configured = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const pathname = "/storage/v1/object/**"

  if (configured) {
    try {
      const url = new URL(configured)
      // ⚠ Le protocole et le port sont DÉRIVÉS de l'URL, pas figés à `https`.
      // Le stack Supabase local est en `http://127.0.0.1:54421` : avec un
      // `protocol: "https"` en dur, l'optimiseur répond 400 `"url" parameter is
      // not allowed` et AUCUNE image ne s'affiche en développement — donc aucun
      // téléversement n'est vérifiable localement. En production `configured`
      // est en https, la valeur dérivée est la même qu'avant.
      return [
        {
          protocol: url.protocol === "http:" ? "http" : "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
          pathname,
        },
      ]
    } catch {
      // URL invalide : on ne casse pas le build pour ça, le repli suffit.
    }
  }
  return [{ protocol: "https", hostname: "*.supabase.co", pathname }]
}

/**
 * Le Supabase configuré est-il un stack LOCAL (boucle locale) ?
 *
 * Next 16 refuse d'optimiser une image dont l'hôte résout vers une IP privée —
 * protection anti-SSRF, et elle a raison. Mais le stack Supabase de
 * développement vit sur `http://127.0.0.1:54421` : sans dérogation, aucune
 * vignette ne s'affiche en local, donc aucun téléversement n'est vérifiable
 * dans l'interface.
 *
 * La dérogation est donc CONDITIONNÉE à un hôte de boucle locale, calculée à
 * partir de la même URL que `remotePatterns`. En production, `SUPABASE_URL`
 * pointe sur `*.supabase.co` : la fonction rend `false` et la protection reste
 * entière. Poser le drapeau à `true` en dur aurait ouvert le réseau interne du
 * VPS à l'optimiseur.
 */
function supabaseEstLocal(): boolean {
  const configured = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!configured) return false
  try {
    const { hostname } = new URL(configured)
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]"
  } catch {
    return false
  }
}

const nextConfig: NextConfig = {
  // Sortie autonome pour l'image Docker (server.js + node_modules tracés).
  output: "standalone",
  // Racine du monorepo : le tracing doit remonter au-dessus de apps/web
  // pour embarquer les dépendances du workspace pnpm.
  outputFileTracingRoot: path.join(here, "../.."),
  images: {
    remotePatterns: supabaseStoragePatterns(),
    dangerouslyAllowLocalIP: supabaseEstLocal(),
  },
}

export default nextConfig
