import { loc } from "@/lib/i18n"
import type { HashtagGroup } from "./types"

// Groupes de hashtags par client — insérables en un clic dans la légende
// ou le premier commentaire IG (≤30 cumulés, voir lib/caption.ts).
export const HASHTAG_GROUPS: HashtagGroup[] = [
  // Brûlerie Lacaze
  {
    id: "hg_bru_marque",
    clientId: "cl_brulerie",
    name: loc("Marque", "Brand"),
    tags: ["#brulerielacaze", "#cafédespécialité", "#torréfactionartisanale", "#brûlerie"],
  },
  {
    id: "hg_bru_local",
    clientId: "cl_brulerie",
    name: loc("Local Lille", "Lille local"),
    tags: ["#lille", "#lillemaville", "#commerçantlillois", "#hautsdefrance"],
  },
  {
    id: "hg_bru_cafe",
    clientId: "cl_brulerie",
    name: loc("Café & dégustation", "Coffee & tasting"),
    tags: ["#specialtycoffee", "#singleorigin", "#baristadaily", "#filtercoffee", "#coffeelover"],
  },
  // Maison Verde
  {
    id: "hg_ver_marque",
    clientId: "cl_verde",
    name: loc("Marque", "Brand"),
    tags: ["#maisonverde", "#bistronomie", "#cuisinedesaison", "#faitmaison"],
  },
  {
    id: "hg_ver_local",
    clientId: "cl_verde",
    name: loc("Produits locaux", "Local produce"),
    tags: ["#circuitcourt", "#produitsfrais", "#marché", "#mangerlocal"],
  },
  {
    id: "hg_ver_brunch",
    clientId: "cl_verde",
    name: loc("Brunch & vins", "Brunch & wines"),
    tags: ["#brunch", "#vinnature", "#accordmetsvins", "#foodlover", "#dimanche"],
  },
  // Atelier Nove
  {
    id: "hg_nov_marque",
    clientId: "cl_nove",
    name: loc("Marque", "Brand"),
    tags: ["#ateliernove", "#moderesponsable", "#madeinfrance", "#slowfashion"],
  },
  {
    id: "hg_nov_style",
    clientId: "cl_nove",
    name: loc("Style", "Style"),
    tags: ["#ootd", "#lookdujour", "#styleinspo", "#capsulewardrobe"],
  },
  {
    id: "hg_nov_matieres",
    clientId: "cl_nove",
    name: loc("Matières & atelier", "Fabrics & workshop"),
    tags: ["#linlavé", "#cuirvégétal", "#couture", "#éthique"],
  },
  // Studio Rise
  {
    id: "hg_ris_marque",
    clientId: "cl_rise",
    name: loc("Marque", "Brand"),
    tags: ["#studiorise", "#yogamontreal", "#bienêtre", "#mtl"],
  },
  {
    id: "hg_ris_pratique",
    clientId: "cl_rise",
    name: loc("Pratique", "Practice"),
    tags: ["#vinyasa", "#yinyoga", "#pranayama", "#méditation", "#yogapractice"],
  },
]

export function getHashtagGroups(clientId: string): HashtagGroup[] {
  return HASHTAG_GROUPS.filter((g) => g.clientId === clientId)
}
