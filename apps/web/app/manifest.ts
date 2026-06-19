import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ocean — le poste de pilotage du freelance",
    short_name: "Ocean",
    description:
      "Planification, aperçu de feed, calendrier, validation client et agenda unifié — dans un seul outil.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b2238",
    theme_color: "#0f3d63",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
