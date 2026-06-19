import type { HashtagGroup } from "./types"

// Groupes de hashtags par client — insérables en un clic dans la légende
// ou le premier commentaire IG (≤30 cumulés, voir lib/caption.ts).
export const HASHTAG_GROUPS: HashtagGroup[] = [
  // Brûlerie Lacaze
  {
    id: "hg_bru_marque",
    clientId: "cl_brulerie",
    name: "Marque",
    tags: ["#brulerielacaze", "#cafédespécialité", "#torréfactionartisanale", "#brûlerie"],
  },
  {
    id: "hg_bru_local",
    clientId: "cl_brulerie",
    name: "Local Lille",
    tags: ["#lille", "#lillemaville", "#commerçantlillois", "#hautsdefrance"],
  },
  {
    id: "hg_bru_cafe",
    clientId: "cl_brulerie",
    name: "Café & dégustation",
    tags: ["#specialtycoffee", "#singleorigin", "#baristadaily", "#filtercoffee", "#coffeelover"],
  },
  // Maison Verde
  {
    id: "hg_ver_marque",
    clientId: "cl_verde",
    name: "Marque",
    tags: ["#maisonverde", "#bistronomie", "#cuisinedesaison", "#faitmaison"],
  },
  {
    id: "hg_ver_local",
    clientId: "cl_verde",
    name: "Produits locaux",
    tags: ["#circuitcourt", "#produitsfrais", "#marché", "#mangerlocal"],
  },
  {
    id: "hg_ver_brunch",
    clientId: "cl_verde",
    name: "Brunch & vins",
    tags: ["#brunch", "#vinnature", "#accordmetsvins", "#foodlover", "#dimanche"],
  },
  // Atelier Nove
  {
    id: "hg_nov_marque",
    clientId: "cl_nove",
    name: "Marque",
    tags: ["#ateliernove", "#moderesponsable", "#madeinfrance", "#slowfashion"],
  },
  {
    id: "hg_nov_style",
    clientId: "cl_nove",
    name: "Style",
    tags: ["#ootd", "#lookdujour", "#styleinspo", "#capsulewardrobe"],
  },
  {
    id: "hg_nov_matieres",
    clientId: "cl_nove",
    name: "Matières & atelier",
    tags: ["#linlavé", "#cuirvégétal", "#couture", "#éthique"],
  },
  // Studio Rise
  {
    id: "hg_ris_marque",
    clientId: "cl_rise",
    name: "Marque",
    tags: ["#studiorise", "#yogamontreal", "#bienêtre", "#mtl"],
  },
  {
    id: "hg_ris_pratique",
    clientId: "cl_rise",
    name: "Pratique",
    tags: ["#vinyasa", "#yinyoga", "#pranayama", "#méditation", "#yogapractice"],
  },
]

export function getHashtagGroups(clientId: string): HashtagGroup[] {
  return HASHTAG_GROUPS.filter((g) => g.clientId === clientId)
}
