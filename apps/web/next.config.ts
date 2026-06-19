import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const here = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Sortie autonome pour l'image Docker (server.js + node_modules tracés).
  output: "standalone",
  // Racine du monorepo : le tracing doit remonter au-dessus de apps/web
  // pour embarquer les dépendances du workspace pnpm.
  outputFileTracingRoot: path.join(here, "../.."),
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
}

export default nextConfig
