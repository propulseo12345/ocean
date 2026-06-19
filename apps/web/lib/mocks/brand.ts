import { loc } from "@/lib/i18n"
import type { BrandKit } from "./types"

// Brand kit par client : palette, ton de voix, règles do/don't et mots
// interdits (consommés par lib/caption.ts pour les garde-fous de légende).
export const BRAND_KITS: BrandKit[] = [
  {
    clientId: "cl_brulerie",
    palette: ["oklch(0.46 0.09 62)", "oklch(0.72 0.08 70)", "oklch(0.95 0.02 80)"],
    tone: loc(
      "Chaleureux et artisanal — tutoiement, vocabulaire sensoriel, jamais de jargon barista sans explication.",
      "Warm and artisanal — casual and personal, sensory vocabulary, never barista jargon without explaining it."
    ),
    doList: [
      loc("Tutoyer la communauté", "Speak to the community on a first-name basis"),
      loc(
        "Raconter l'origine des cafés (ferme, altitude, producteur)",
        "Tell the story behind each coffee (farm, altitude, grower)"
      ),
      loc("Mettre en avant le geste artisanal", "Spotlight the craft behind every cup"),
    ],
    dontList: [
      loc("Promotions agressives ou urgence artificielle", "Pushy promos or fake urgency"),
      loc("Jargon technique sans le traduire", "Technical jargon left unexplained"),
      loc("Plus d'un emoji par phrase", "More than one emoji per sentence"),
    ],
    bannedWords: ["promo flash", "discount", "capsule", "starbucks"],
  },
  {
    clientId: "cl_verde",
    palette: ["oklch(0.53 0.12 150)", "oklch(0.85 0.06 140)", "oklch(0.35 0.05 155)"],
    tone: loc(
      "Élégant et gourmand — vouvoiement systématique, on parle produit et saison avant tout.",
      "Elegant and indulgent — always formal and polished, leading with the produce and the season."
    ),
    doList: [
      loc("Vouvoyer la clientèle", "Address guests formally"),
      loc(
        "Citer les producteurs et le marché du jour",
        "Name the growers and the day's market finds"
      ),
      loc(
        "Inviter à réserver en fin de légende",
        "Invite readers to book a table at the end of the caption"
      ),
    ],
    dontList: [
      loc("Tutoiement (exigence de Sofia)", "Casual tone (Sofia's hard rule)"),
      loc("Photos de salle vide", "Photos of an empty dining room"),
      loc("Prix affichés dans les légendes", "Prices spelled out in captions"),
    ],
    bannedWords: ["malbouffe", "fast-food", "surgelé", "industriel"],
  },
  {
    clientId: "cl_nove",
    palette: ["oklch(0.58 0.16 352)", "oklch(0.9 0.04 60)", "oklch(0.65 0.1 50)"],
    tone: loc(
      "Minimaliste et engagé — phrases courtes, matières et fabrication française en étendard.",
      "Minimalist and purpose-driven — short sentences, championing materials and French craftsmanship."
    ),
    doList: [
      loc(
        "Nommer les matières (lin lavé, cuir végétal)",
        "Name the materials (washed linen, vegetable-tanned leather)"
      ),
      loc(
        "Montrer l'atelier et les mains qui font",
        "Show the workshop and the hands that make it"
      ),
      loc(
        "Encourager le repost communauté #AtelierNove",
        "Encourage community reposts with #AtelierNove"
      ),
    ],
    dontList: [
      loc("Vocabulaire de la fast fashion", "Fast-fashion vocabulary"),
      loc("Soldes criardes ou compte à rebours", "Loud sales or countdown timers"),
      loc(
        "Superlatifs creux (« incroyable », « révolutionnaire »)",
        'Empty superlatives ("amazing", "revolutionary")'
      ),
    ],
    bannedWords: ["fast fashion", "destockage", "shein", "soldes monstres"],
  },
  {
    clientId: "cl_rise",
    palette: ["oklch(0.56 0.13 292)", "oklch(0.92 0.03 290)", "oklch(0.4 0.08 295)"],
    tone: loc(
      "Apaisant et inclusif — tutoiement doux, zéro promesse de résultat, on parle pratique et ressenti.",
      "Calming and inclusive — gentle and personal, no promised results, focused on the practice and how it feels."
    ),
    doList: [
      loc("Rappeler que chaque niveau est bienvenu", "Remind everyone that all levels are welcome"),
      loc("Citer les profs par leur prénom", "Mention the teachers by their first name"),
      loc("Proposer le replay aux membres en ligne", "Offer the replay to online members"),
    ],
    dontList: [
      loc("Promesses de transformation physique", "Promises of physical transformation"),
      loc(
        "Vocabulaire de la performance (« no pain no gain »)",
        'Performance-driven language ("no pain no gain")'
      ),
      loc(
        "Images de postures inaccessibles sans contexte",
        "Photos of inaccessible poses without context"
      ),
    ],
    bannedWords: ["détox", "perte de poids", "miracle", "guérison"],
  },
]

export function getBrandKit(clientId: string): BrandKit | undefined {
  return BRAND_KITS.find((b) => b.clientId === clientId)
}
