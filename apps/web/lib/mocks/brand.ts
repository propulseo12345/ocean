import type { BrandKit } from "./types"

// Brand kit par client : palette, ton de voix, règles do/don't et mots
// interdits (consommés par lib/caption.ts pour les garde-fous de légende).
export const BRAND_KITS: BrandKit[] = [
  {
    clientId: "cl_brulerie",
    palette: ["oklch(0.46 0.09 62)", "oklch(0.72 0.08 70)", "oklch(0.95 0.02 80)"],
    tone: "Chaleureux et artisanal — tutoiement, vocabulaire sensoriel, jamais de jargon barista sans explication.",
    doList: [
      "Tutoyer la communauté",
      "Raconter l'origine des cafés (ferme, altitude, producteur)",
      "Mettre en avant le geste artisanal",
    ],
    dontList: [
      "Promotions agressives ou urgence artificielle",
      "Jargon technique sans le traduire",
      "Plus d'un emoji par phrase",
    ],
    bannedWords: ["promo flash", "discount", "capsule", "starbucks"],
  },
  {
    clientId: "cl_verde",
    palette: ["oklch(0.53 0.12 150)", "oklch(0.85 0.06 140)", "oklch(0.35 0.05 155)"],
    tone: "Élégant et gourmand — vouvoiement systématique, on parle produit et saison avant tout.",
    doList: [
      "Vouvoyer la clientèle",
      "Citer les producteurs et le marché du jour",
      "Inviter à réserver en fin de légende",
    ],
    dontList: [
      "Tutoiement (exigence de Sofia)",
      "Photos de salle vide",
      "Prix affichés dans les légendes",
    ],
    bannedWords: ["malbouffe", "fast-food", "surgelé", "industriel"],
  },
  {
    clientId: "cl_nove",
    palette: ["oklch(0.58 0.16 352)", "oklch(0.9 0.04 60)", "oklch(0.65 0.1 50)"],
    tone: "Minimaliste et engagé — phrases courtes, matières et fabrication française en étendard.",
    doList: [
      "Nommer les matières (lin lavé, cuir végétal)",
      "Montrer l'atelier et les mains qui font",
      "Encourager le repost communauté #AtelierNove",
    ],
    dontList: [
      "Vocabulaire de la fast fashion",
      "Soldes criardes ou compte à rebours",
      "Superlatifs creux (« incroyable », « révolutionnaire »)",
    ],
    bannedWords: ["fast fashion", "destockage", "shein", "soldes monstres"],
  },
  {
    clientId: "cl_rise",
    palette: ["oklch(0.56 0.13 292)", "oklch(0.92 0.03 290)", "oklch(0.4 0.08 295)"],
    tone: "Apaisant et inclusif — tutoiement doux, zéro promesse de résultat, on parle pratique et ressenti.",
    doList: [
      "Rappeler que chaque niveau est bienvenu",
      "Citer les profs par leur prénom",
      "Proposer le replay aux membres en ligne",
    ],
    dontList: [
      "Promesses de transformation physique",
      "Vocabulaire de la performance (« no pain no gain »)",
      "Images de postures inaccessibles sans contexte",
    ],
    bannedWords: ["détox", "perte de poids", "miracle", "guérison"],
  },
]

export function getBrandKit(clientId: string): BrandKit | undefined {
  return BRAND_KITS.find((b) => b.clientId === clientId)
}
