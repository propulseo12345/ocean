import { CLIENTS } from "./clients"
import { CONTENT_ITEMS } from "./content"
import { IMAGES } from "./images"
import { dayAt } from "./time"
import type { Client, LibraryAsset, LibraryAssetSource } from "./types"

// Médiathèque par client : tout le pool d'images devient des assets, avec
// usages réels calculés depuis les contenus (mêmes URLs) → mix utilisés/inédits.

const ALT_TEXTS: Record<Client["theme"], string[]> = {
  coffee: [
    "Tasse de café filtre fraîchement servie sur le comptoir",
    "Latte art en forme de cœur, vue de dessus",
    "Grains de café vert avant torréfaction",
    "Le torréfacteur surveille la cuisson au tambour",
    "Sacs de café single origin alignés en boutique",
  ],
  food: [
    "Assiette d'asperges vertes et œuf parfait",
    "Table de brunch vue de dessus, jus pressés",
    "La brigade en plein coup de feu",
    "Part de tarte au citron meringuée",
    "Légumes du marché posés sur le passe",
  ],
  fashion: [
    "Veste en lin lavé portée en lumière naturelle",
    "Flatlay maille côtelée et accessoires",
    "Mains de couturière en plein patronage",
    "Sac en cuir tanné végétal sur fond neutre",
    "Silhouette lookbook dans les tons sable",
  ],
  yoga: [
    "Posture de l'arbre tenue en studio",
    "Salle de cours baignée de lumière du matin",
    "Séance de pranayama en groupe",
    "Tapis et briques de yoga alignés",
    "Méditation guidée à la tombée du jour",
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
