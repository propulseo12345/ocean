import { loc } from "@/lib/i18n"
import type { L } from "@/lib/i18n/localized"
import { CLIENTS } from "./clients"
import { CONTENT_ITEMS } from "./content"
import { IMAGES } from "./images"
import { dayAt } from "./time"
import type { Client, LibraryAsset, LibraryAssetSource } from "./types"

// Médiathèque par client : tout le pool d'images devient des assets, avec
// usages réels calculés depuis les contenus (mêmes URLs) → mix utilisés/inédits.

const ALT_TEXTS: Record<Client["theme"], L<string>[]> = {
  coffee: [
    loc(
      "Tasse de café filtre fraîchement servie sur le comptoir",
      "Cup of freshly brewed pour-over coffee on the counter"
    ),
    loc("Latte art en forme de cœur, vue de dessus", "Heart-shaped latte art, top-down view"),
    loc("Grains de café vert avant torréfaction", "Green coffee beans before roasting"),
    loc(
      "Le torréfacteur surveille la cuisson au tambour",
      "The roaster keeps an eye on the drum roast"
    ),
    loc(
      "Sacs de café single origin alignés en boutique",
      "Single-origin coffee bags lined up in the shop"
    ),
  ],
  food: [
    loc(
      "Assiette d'asperges vertes et œuf parfait",
      "Plate of green asparagus with a perfect poached egg"
    ),
    loc(
      "Table de brunch vue de dessus, jus pressés",
      "Brunch spread shot from above with fresh-pressed juices"
    ),
    loc("La brigade en plein coup de feu", "The kitchen crew in the thick of service"),
    loc("Part de tarte au citron meringuée", "Slice of lemon meringue pie"),
    loc("Légumes du marché posés sur le passe", "Market-fresh vegetables laid out on the pass"),
  ],
  fashion: [
    loc(
      "Veste en lin lavé portée en lumière naturelle",
      "Washed-linen jacket worn in natural light"
    ),
    loc("Flatlay maille côtelée et accessoires", "Flatlay of ribbed knitwear and accessories"),
    loc("Mains de couturière en plein patronage", "Seamstress's hands mid pattern-making"),
    loc(
      "Sac en cuir tanné végétal sur fond neutre",
      "Vegetable-tanned leather bag on a neutral backdrop"
    ),
    loc("Silhouette lookbook dans les tons sable", "Lookbook silhouette in sandy tones"),
  ],
  yoga: [
    loc("Posture de l'arbre tenue en studio", "Tree pose held in the studio"),
    loc("Salle de cours baignée de lumière du matin", "Class space bathed in morning light"),
    loc("Séance de pranayama en groupe", "Group pranayama session"),
    loc("Tapis et briques de yoga alignés", "Yoga mats and blocks neatly lined up"),
    loc("Méditation guidée à la tombée du jour", "Guided meditation at dusk"),
  ],
}

const SHORTS: Record<string, string> = {
  cl_brulerie: "bru",
  cl_verde: "ver",
  cl_nove: "nov",
  cl_rise: "ris",
}

function sourceFor(j: number): LibraryAssetSource {
  if (j === 8 || j === 10) return "depot_client"
  if (j >= 9) return "import"
  return "upload"
}

function buildLibrary(client: Client): LibraryAsset[] {
  const pool = IMAGES[client.theme]
  const alts = ALT_TEXTS[client.theme]
  const short = SHORTS[client.id] ?? client.id

  return pool.map((url, j) => {
    const usedInContentIds = CONTENT_ITEMS.filter(
      (c) => c.clientId === client.id && !c.deletedAt && c.media.some((m) => m.thumbUrl === url)
    ).map((c) => c.id)

    const isVideo = j === 1
    // j === 8 : asset volontairement hors specs (PNG 9,4 Mo, ratio 3:1) pour
    // la démo de validation lib/specs.ts ; j === 10 : HEIC iPhone à convertir.
    const offSpec = j === 8
    const heic = j === 10

    return {
      id: `la_${short}_${j}`,
      clientId: client.id,
      type: isVideo ? ("video" as const) : ("image" as const),
      thumbUrl: url,
      fullUrl: url,
      width: offSpec ? 2400 : 1080,
      height: offSpec ? 800 : isVideo ? 1920 : j === 4 ? 1350 : 1080,
      durationSec: isVideo ? 21 : undefined,
      uploadedAt: dayAt(-26 + j * 2, 10),
      source: sourceFor(j),
      usedInContentIds,
      altText: j < alts.length ? alts[j] : undefined,
      fileSizeMb: isVideo ? 58 : offSpec ? 9.4 : Math.round((1.8 + j * 0.3) * 10) / 10,
      mimeType: isVideo ? "video/mp4" : offSpec ? "image/png" : heic ? "image/heic" : "image/jpeg",
    }
  })
}

export const LIBRARY_ASSETS: LibraryAsset[] = CLIENTS.filter((c) => !c.archivedAt).flatMap(
  buildLibrary
)

export function getLibraryAssets(clientId: string): LibraryAsset[] {
  return LIBRARY_ASSETS.filter((a) => a.clientId === clientId)
}

export function getLibraryAsset(id: string): LibraryAsset | undefined {
  return LIBRARY_ASSETS.find((a) => a.id === id)
}
