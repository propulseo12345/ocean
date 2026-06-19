import { loc } from "@/lib/i18n"
import type { ContentPillar } from "./types"

// Piliers éditoriaux par client — couleurs sur les tokens chart-1..4.
type PillarDef = [slug: string, nameFr: string, nameEn: string, targetShare: number]

function pillarsFor(clientId: string, short: string, defs: PillarDef[]): ContentPillar[] {
  return defs.map(([slug, nameFr, nameEn, targetShare], i) => ({
    id: `pil_${short}_${slug}`,
    clientId,
    name: loc(nameFr, nameEn),
    colorVar: `var(--chart-${i + 1})`,
    targetShare,
  }))
}

export const CONTENT_PILLARS: ContentPillar[] = [
  ...pillarsFor("cl_brulerie", "bru", [
    ["produit", "Produit & nouveautés", "Products & new arrivals", 30],
    ["coulisses", "Coulisses & torréfaction", "Behind the scenes & roasting", 25],
    ["conseils", "Conseils & dégustation", "Tips & tasting", 25],
    ["communaute", "Communauté & avis", "Community & reviews", 20],
  ]),
  ...pillarsFor("cl_verde", "ver", [
    ["menu", "Menu & saison", "Menu & seasonal", 35],
    ["coulisses", "Coulisses cuisine", "Kitchen behind the scenes", 25],
    ["equipe", "Équipe & savoir-faire", "Team & craft", 20],
    ["avis", "Avis clients", "Customer reviews", 20],
  ]),
  ...pillarsFor("cl_nove", "nov", [
    ["collection", "Collection & produit", "Collection & product", 40],
    ["lookbook", "Lookbook & styling", "Lookbook & styling", 25],
    ["atelier", "Atelier & fabrication", "Workshop & making", 20],
    ["ugc", "Communauté & UGC", "Community & UGC", 15],
  ]),
  ...pillarsFor("cl_rise", "ris", [
    ["cours", "Cours & ateliers", "Classes & workshops", 35],
    ["pedagogie", "Postures & pédagogie", "Poses & teaching", 30],
    ["bienetre", "Bien-être & inspiration", "Wellness & inspiration", 20],
    ["studio", "Vie du studio", "Studio life", 15],
  ]),
]

export function getPillars(clientId: string): ContentPillar[] {
  return CONTENT_PILLARS.filter((p) => p.clientId === clientId)
}

export function getPillar(id: string): ContentPillar | undefined {
  return CONTENT_PILLARS.find((p) => p.id === id)
}
