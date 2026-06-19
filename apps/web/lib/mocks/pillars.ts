import type { ContentPillar } from "./types"

// Piliers éditoriaux par client — couleurs sur les tokens chart-1..4.
type PillarDef = [slug: string, name: string, targetShare: number]

function pillarsFor(clientId: string, short: string, defs: PillarDef[]): ContentPillar[] {
  return defs.map(([slug, name, targetShare], i) => ({
    id: `pil_${short}_${slug}`,
    clientId,
    name,
    colorVar: `var(--chart-${i + 1})`,
    targetShare,
  }))
}

export const CONTENT_PILLARS: ContentPillar[] = [
  ...pillarsFor("cl_brulerie", "bru", [
    ["produit", "Produit & nouveautés", 30],
    ["coulisses", "Coulisses & torréfaction", 25],
    ["conseils", "Conseils & dégustation", 25],
    ["communaute", "Communauté & avis", 20],
  ]),
  ...pillarsFor("cl_verde", "ver", [
    ["menu", "Menu & saison", 35],
    ["coulisses", "Coulisses cuisine", 25],
    ["equipe", "Équipe & savoir-faire", 20],
    ["avis", "Avis clients", 20],
  ]),
  ...pillarsFor("cl_nove", "nov", [
    ["collection", "Collection & produit", 40],
    ["lookbook", "Lookbook & styling", 25],
    ["atelier", "Atelier & fabrication", 20],
    ["ugc", "Communauté & UGC", 15],
  ]),
  ...pillarsFor("cl_rise", "ris", [
    ["cours", "Cours & ateliers", 35],
    ["pedagogie", "Postures & pédagogie", 30],
    ["bienetre", "Bien-être & inspiration", 20],
    ["studio", "Vie du studio", 15],
  ]),
]

export function getPillars(clientId: string): ContentPillar[] {
  return CONTENT_PILLARS.filter((p) => p.clientId === clientId)
}

export function getPillar(id: string): ContentPillar | undefined {
  return CONTENT_PILLARS.find((p) => p.id === id)
}
