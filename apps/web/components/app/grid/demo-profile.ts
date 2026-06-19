import type { InstagramProfileData } from "./instagram-profile-header"

// Identité fictive du mode « démo prospect » : maquettes avant-vente sans
// exposer un vrai client (état local, réversible).
export const DEMO_PROSPECT: Omit<InstagramProfileData, "avatarUrl" | "postCount" | "highlights"> = {
  name: "Café Riviera",
  handle: "cafe.riviera",
  category: "Café · Maquette avant-vente",
  bio: "Démo prospect — données fictives ✨\nCompose le futur feed avant d'avoir les accès Meta.",
  followers: 1280,
  following: 210,
}
