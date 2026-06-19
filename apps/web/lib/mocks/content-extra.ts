import { IMAGES } from "./images"
import { getPillars } from "./pillars"
import { dayAt } from "./time"
import type { ContentItem, Platform } from "./types"

// Enrichissement de la timeline générée (content.ts) : piliers, épinglés,
// étiquettes, premier commentaire, covers de Reel, légendes déclinées…

// Pilier attribué selon l'index de copy (cohérent avec COPY_POOL, i % 6).
const COPY_TO_PILLAR = [0, 1, 2, 1, 0, 3]

export function contentExtras(index: number, clientId: string): Partial<ContentItem> {
  const pillars = getPillars(clientId)
  if (pillars.length === 0) return {}
  const pos = COPY_TO_PILLAR[index % COPY_TO_PILLAR.length] % pillars.length
  return { pillarId: pillars[pos].id }
}

// Retouches ciblées par contenu (id = ct_<clientId>_<index du blueprint>).
export const CONTENT_OVERRIDES: Record<string, Partial<ContentItem>> = {
  // Brûlerie Lacaze
  ct_cl_brulerie_0: { pinned: true, labels: ["Lancement"] },
  ct_cl_brulerie_4: { labels: ["Promo"] },
  ct_cl_brulerie_7: {
    firstComment: "#specialtycoffee #singleorigin #baristadaily #filtercoffee #lille",
  },
  ct_cl_brulerie_9: { coverUrl: IMAGES.coffee[10] },
  ct_cl_brulerie_13: { approvalStale: true, labels: ["Evergreen"] },
  ct_cl_brulerie_16: {
    labels: ["Marronnier"],
    internalNotes: "Idée pour la fête de la musique (21 juin) — voir avec Camille.",
  },
  // Maison Verde
  ct_cl_verde_1: { labels: ["Evergreen"] },
  ct_cl_verde_2: { coverUrl: IMAGES.food[10] },
  ct_cl_verde_7: {
    firstComment: "#brunch #vinnature #accordmetsvins #foodlover #dimanche #maisonverde",
    labels: ["Marronnier"],
  },
  ct_cl_verde_9: { coverUrl: IMAGES.food[11] },
  // Atelier Nove
  ct_cl_nove_1: { pinned: true, labels: ["Lancement"] },
  ct_cl_nove_15: {
    labels: ["Promo"],
    internalNotes: "À programmer pour le début des soldes d'été (24 juin).",
  },
  // Studio Rise
  ct_cl_rise_2: { excludeFromGrid: true },
  ct_cl_rise_16: {
    labels: ["Marronnier"],
    internalNotes: "Journée internationale du yoga le 21 juin — prévoir le cours gratuit.",
  },
}

// Légendes déclinées par plateforme (ContentTarget.captionOverride).
export const TARGET_CAPTION_OVERRIDES: Record<string, Partial<Record<Platform, string>>> = {
  ct_cl_verde_7: {
    facebook:
      "Le brunch est de retour ce dimanche ! Pancakes, granola maison, jus pressés. Réservez votre table : maisonverde.fr/brunch",
  },
  ct_cl_verde_9: {
    tiktok: "La tarte au citron qu'on ne présente plus 🍋 #dessert #foodtok #patisserie",
  },
  ct_cl_nove_13: {
    tiktok: "POV : tu cherches LA maille de mi-saison 🧶 #fashiontok #ootd",
  },
}

// Contenus hors timeline générée : corbeille (deletedAt) et annulé.
export const EXTRA_CONTENT_ITEMS: ContentItem[] = [
  {
    id: "ct_cl_brulerie_x1",
    clientId: "cl_brulerie",
    title: "Promo flash sur les capsules",
    caption:
      "Promo flash ce week-end : -30 % sur les capsules compatibles. Fonce, le stock part vite !",
    hashtags: ["#promo", "#café"],
    format: "post",
    status: "draft",
    scheduledAt: null,
    internalNotes:
      "Supprimé : hors charte (« promo flash » et « capsule » interdits au brand kit).",
    media: [
      {
        id: "md_cl_brulerie_x1_0",
        type: "image",
        thumbUrl: IMAGES.coffee[7],
        fullUrl: IMAGES.coffee[7],
        width: 1080,
        height: 1080,
        position: 0,
      },
    ],
    targets: [
      {
        id: "tg_ct_cl_brulerie_x1_instagram",
        platform: "instagram",
        socialAccountId: "sa_bru_ig",
        status: "pending",
      },
    ],
    createdAt: dayAt(-10, 9),
    createdBy: "usr_etienne",
    commentsCount: 0,
    deletedAt: dayAt(-2, 11),
  },
  {
    id: "ct_cl_verde_x1",
    clientId: "cl_verde",
    title: "Concours stories — à revoir",
    caption: "Jeu concours : un brunch pour deux à gagner. Modalités à définir avec Sofia.",
    hashtags: [],
    format: "story",
    status: "idea",
    scheduledAt: null,
    media: [],
    targets: [
      {
        id: "tg_ct_cl_verde_x1_instagram",
        platform: "instagram",
        socialAccountId: "sa_ver_ig",
        status: "pending",
      },
    ],
    createdAt: dayAt(-20, 10),
    createdBy: "usr_etienne",
    commentsCount: 0,
    deletedAt: dayAt(-6, 14),
  },
  {
    id: "ct_cl_rise_x1",
    clientId: "cl_rise",
    title: "Défi 30 jours de yoga",
    caption: "Un mois, une posture par jour. Le défi commence lundi — qui est partant ?",
    hashtags: ["#yogachallenge", "#30jours"],
    format: "post",
    status: "canceled",
    scheduledAt: dayAt(-7, 12),
    internalNotes: "Annulé d'un commun accord avec Marc — remplacé par la retraite de printemps.",
    media: [
      {
        id: "md_cl_rise_x1_0",
        type: "image",
        thumbUrl: IMAGES.yoga[7],
        fullUrl: IMAGES.yoga[7],
        width: 1080,
        height: 1080,
        position: 0,
      },
    ],
    targets: [
      {
        id: "tg_ct_cl_rise_x1_instagram",
        platform: "instagram",
        socialAccountId: "sa_ris_ig",
        status: "canceled",
      },
    ],
    createdAt: dayAt(-15, 9),
    createdBy: "usr_etienne",
    commentsCount: 0,
    pillarId: "pil_ris_cours",
  },
]
