import { loc } from "@/lib/i18n"
import type { L } from "@/lib/i18n/localized"
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
  ct_cl_brulerie_0: { pinned: true, labels: [loc("Lancement", "Launch")] },
  ct_cl_brulerie_4: { labels: [loc("Promo", "Promo")] },
  ct_cl_brulerie_7: {
    firstComment: loc(
      "#specialtycoffee #singleorigin #baristadaily #filtercoffee #lille",
      "#specialtycoffee #singleorigin #baristadaily #filtercoffee #lille"
    ),
  },
  ct_cl_brulerie_9: { coverUrl: IMAGES.coffee[10] },
  ct_cl_brulerie_13: { approvalStale: true, labels: [loc("Evergreen", "Evergreen")] },
  ct_cl_brulerie_16: {
    labels: [loc("Marronnier", "Seasonal")],
    internalNotes: loc(
      "Idée pour la fête de la musique (21 juin) — voir avec Camille.",
      "Idea for the Fête de la Musique (June 21) — check with Camille."
    ),
  },
  // Maison Verde
  ct_cl_verde_1: { labels: [loc("Evergreen", "Evergreen")] },
  ct_cl_verde_2: { coverUrl: IMAGES.food[10] },
  ct_cl_verde_7: {
    firstComment: loc(
      "#brunch #vinnature #accordmetsvins #foodlover #dimanche #maisonverde",
      "#brunch #vinnature #accordmetsvins #foodlover #dimanche #maisonverde"
    ),
    labels: [loc("Marronnier", "Seasonal")],
  },
  ct_cl_verde_9: { coverUrl: IMAGES.food[11] },
  // Atelier Nove
  ct_cl_nove_1: { pinned: true, labels: [loc("Lancement", "Launch")] },
  ct_cl_nove_15: {
    labels: [loc("Promo", "Promo")],
    internalNotes: loc(
      "À programmer pour le début des soldes d'été (24 juin).",
      "To schedule for the start of the summer sales (June 24)."
    ),
  },
  // Studio Rise
  ct_cl_rise_2: { excludeFromGrid: true },
  ct_cl_rise_16: {
    labels: [loc("Marronnier", "Seasonal")],
    internalNotes: loc(
      "Journée internationale du yoga le 21 juin — prévoir le cours gratuit.",
      "International Yoga Day on June 21 — plan the free class."
    ),
  },
}

// Légendes déclinées par plateforme (ContentTarget.captionOverride).
export const TARGET_CAPTION_OVERRIDES: Record<string, Partial<Record<Platform, L<string>>>> = {
  ct_cl_verde_7: {
    facebook: loc(
      "Le brunch est de retour ce dimanche ! Pancakes, granola maison, jus pressés. Réservez votre table : maisonverde.fr/brunch",
      "Brunch is back this Sunday! Pancakes, house-made granola, fresh-pressed juices. Book your table: maisonverde.fr/brunch"
    ),
  },
  ct_cl_verde_9: {
    tiktok: loc(
      "La tarte au citron qu'on ne présente plus 🍋 #dessert #foodtok #patisserie",
      "The lemon tart that needs no introduction 🍋 #dessert #foodtok #patisserie"
    ),
  },
  ct_cl_nove_13: {
    tiktok: loc(
      "POV : tu cherches LA maille de mi-saison 🧶 #fashiontok #ootd",
      "POV: you're hunting for THE mid-season knit 🧶 #fashiontok #ootd"
    ),
  },
}

// Contenus hors timeline générée : corbeille (deletedAt) et annulé.
export const EXTRA_CONTENT_ITEMS: ContentItem[] = [
  {
    id: "ct_cl_brulerie_x1",
    clientId: "cl_brulerie",
    title: loc("Promo flash sur les capsules", "Flash sale on capsules"),
    caption: loc(
      "Promo flash ce week-end : -30 % sur les capsules compatibles. Fonce, le stock part vite !",
      "Flash sale this weekend: -30% on compatible capsules. Hurry, stock is going fast!"
    ),
    hashtags: ["#promo", "#café"],
    format: "post",
    status: "draft",
    scheduledAt: null,
    internalNotes: loc(
      "Supprimé : hors charte (« promo flash » et « capsule » interdits au brand kit).",
      "Deleted: off-brand (“flash sale” and “capsule” banned in the brand kit)."
    ),
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
    title: loc("Concours stories — à revoir", "Stories giveaway — needs review"),
    caption: loc(
      "Jeu concours : un brunch pour deux à gagner. Modalités à définir avec Sofia.",
      "Giveaway: win a brunch for two. Terms to be defined with Sofia."
    ),
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
    title: loc("Défi 30 jours de yoga", "30-day yoga challenge"),
    caption: loc(
      "Un mois, une posture par jour. Le défi commence lundi — qui est partant ?",
      "One month, one pose a day. The challenge starts Monday — who's in?"
    ),
    hashtags: ["#yogachallenge", "#30jours"],
    format: "post",
    status: "canceled",
    scheduledAt: dayAt(-7, 12),
    internalNotes: loc(
      "Annulé d'un commun accord avec Marc — remplacé par la retraite de printemps.",
      "Cancelled by mutual agreement with Marc — replaced by the spring retreat."
    ),
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
