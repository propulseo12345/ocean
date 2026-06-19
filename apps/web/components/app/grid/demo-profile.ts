import type { Translator } from "@/lib/i18n"
import type { InstagramProfileData } from "./instagram-profile-header"

// Identité fictive du mode « démo prospect » : maquettes avant-vente sans
// exposer un vrai client (état local, réversible). Le nom et le handle sont des
// noms propres ; catégorie et bio sont localisés via le dictionnaire.
export function demoProspect(
  t: Translator
): Omit<InstagramProfileData, "avatarUrl" | "postCount" | "highlights"> {
  return {
    name: "Café Riviera",
    handle: "cafe.riviera",
    category: t("grid.demoProfile.category"),
    bio: t("grid.demoProfile.bio"),
    followers: 1280,
    following: 210,
  }
}
