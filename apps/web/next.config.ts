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
      return [{ protocol: "https", hostname: new URL(configured).hostname, pathname }]
    } catch {
      // URL invalide : on ne casse pas le build pour ça, le repli suffit.
    }
  }
  return [{ protocol: "https", hostname: "*.supabase.co", pathname }]
}

const nextConfig: NextConfig = {
  // Sortie autonome pour l'image Docker (server.js + node_modules tracés).
  output: "standalone",
  // Racine du monorepo : le tracing doit remonter au-dessus de apps/web
  // pour embarquer les dépendances du workspace pnpm.
  outputFileTracingRoot: path.join(here, "../.."),
  images: {
    remotePatterns: supabaseStoragePatterns(),
  },
}

export default nextConfig
