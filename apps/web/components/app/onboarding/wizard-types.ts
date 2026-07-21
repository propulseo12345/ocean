import type { ApprovalMode, Platform } from "@/lib/domain"
import type { MessageKey } from "@/lib/i18n"

// État centralisé du wizard de création d'un client (preview, en mémoire).
// Les champs reprennent le vocabulaire de la future donnée : Client, BrandKit,
// ContentPillar, RecurringSlot — pour brancher la DB ensuite sans réécrire l'UI.

export type WizardStepId = "identity" | "accounts" | "brand" | "strategy" | "review"

export interface DraftSocialAccount {
  platform: Platform
  username: string
  connected: boolean
}

export interface DraftPillar {
  id: string
  name: string
  colorVar: string
  targetShare: number
}

export interface DraftSlot {
  id: string
  weekday: number
  time: string
  platforms: Platform[]
}

export interface ClientDraft {
  // Étape 1 — identité
  name: string
  handle: string
  category: string
  bio: string
  timezone: string
  brandColor: string
  // Étape 2 — comptes sociaux
  accounts: DraftSocialAccount[]
  // Étape 3 — identité de marque (brand kit light)
  palette: string[]
  tone: string
  doList: string[]
  dontList: string[]
  bannedWords: string[]
  // Étape 4 — stratégie de contenu
  pillars: DraftPillar[]
  slots: DraftSlot[]
  approvalMode: ApprovalMode
  // Étape 5 — invitation reviewer (optionnel)
  reviewerEmail: string
}

// Plateformes connectables par API (les manuelles restent hors onboarding).
export const CONNECTABLE_PLATFORMS: Platform[] = ["instagram", "facebook", "tiktok"]

// Catégories d'activité courantes pour un freelance SMM en France.
// `value` = identifiant stable (stocké, sert de clé PILLAR_SUGGESTIONS) ;
// `labelKey` = clé i18n du libellé affiché.
export const CATEGORIES: { value: string; labelKey: MessageKey }[] = [
  { value: "restaurant", labelKey: "onboarding.category.restaurant" },
  { value: "fashion", labelKey: "onboarding.category.fashion" },
  { value: "beauty", labelKey: "onboarding.category.beauty" },
  { value: "craft", labelKey: "onboarding.category.craft" },
  { value: "services", labelKey: "onboarding.category.services" },
  { value: "sport", labelKey: "onboarding.category.sport" },
  { value: "realEstate", labelKey: "onboarding.category.realEstate" },
  { value: "health", labelKey: "onboarding.category.health" },
  { value: "culture", labelKey: "onboarding.category.culture" },
  { value: "other", labelKey: "onboarding.category.other" },
]

// Fuseaux courants côté clients FR + DOM-TOM (le freelance garde le sien).
export const TIMEZONES: { value: string; labelKey: MessageKey }[] = [
  { value: "Europe/Paris", labelKey: "onboarding.timezone.paris" },
  { value: "Europe/Brussels", labelKey: "onboarding.timezone.brussels" },
  { value: "Europe/Luxembourg", labelKey: "onboarding.timezone.luxembourg" },
  { value: "Indian/Reunion", labelKey: "onboarding.timezone.reunion" },
  { value: "America/Martinique", labelKey: "onboarding.timezone.martinique" },
  { value: "America/Guadeloupe", labelKey: "onboarding.timezone.guadeloupe" },
  { value: "America/Cayenne", labelKey: "onboarding.timezone.guiana" },
  { value: "Pacific/Tahiti", labelKey: "onboarding.timezone.tahiti" },
  { value: "America/Montreal", labelKey: "onboarding.timezone.montreal" },
]

// Tons éditoriaux proposés (BrandKit.tone résumé en une phrase à l'usage réel).
// `value` = clé i18n du ton (stockée dans le draft + libellé affiché).
export const TONES: MessageKey[] = [
  "onboarding.tone.warm",
  "onboarding.tone.professional",
  "onboarding.tone.casual",
  "onboarding.tone.premium",
  "onboarding.tone.committed",
  "onboarding.tone.educational",
]

// Palette de teintes de marque (oklch) — cliquables, jamais de picker hex.
// Couleurs lisibles en avatar (texte blanc) dans les deux thèmes.
export const BRAND_COLORS: { value: string; labelKey: MessageKey }[] = [
  { value: "oklch(0.46 0.09 62)", labelKey: "onboarding.color.cafe" },
  { value: "oklch(0.53 0.12 150)", labelKey: "onboarding.color.green" },
  { value: "oklch(0.58 0.16 352)", labelKey: "onboarding.color.pink" },
  { value: "oklch(0.56 0.13 292)", labelKey: "onboarding.color.purple" },
  { value: "oklch(0.55 0.15 25)", labelKey: "onboarding.color.coral" },
  { value: "oklch(0.55 0.13 235)", labelKey: "onboarding.color.blue" },
  { value: "oklch(0.6 0.12 200)", labelKey: "onboarding.color.cyan" },
  { value: "oklch(0.58 0.11 145)", labelKey: "onboarding.color.emerald" },
  { value: "oklch(0.6 0.13 85)", labelKey: "onboarding.color.amber" },
  { value: "oklch(0.5 0.07 48)", labelKey: "onboarding.color.earth" },
  { value: "oklch(0.5 0.05 280)", labelKey: "onboarding.color.slate" },
  { value: "oklch(0.45 0.02 250)", labelKey: "onboarding.color.graphite" },
]

// Couleurs de piliers sur les tokens de thème (cohérent avec lib/mocks/pillars).
export const PILLAR_COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

// Suggestions de piliers selon la catégorie choisie (réflexe pro du batch).
// Clé = `value` de CATEGORIES ; valeurs = clés i18n des libellés de piliers.
export const PILLAR_SUGGESTIONS: Record<string, MessageKey[]> = {
  restaurant: [
    "onboarding.pillarSuggestion.productMenu",
    "onboarding.pillarSuggestion.backstage",
    "onboarding.pillarSuggestion.reviews",
    "onboarding.pillarSuggestion.events",
  ],
  fashion: [
    "onboarding.pillarSuggestion.collection",
    "onboarding.pillarSuggestion.lookbook",
    "onboarding.pillarSuggestion.workshop",
    "onboarding.pillarSuggestion.communityUgc",
  ],
  beauty: [
    "onboarding.pillarSuggestion.careProducts",
    "onboarding.pillarSuggestion.tips",
    "onboarding.pillarSuggestion.beforeAfter",
    "onboarding.pillarSuggestion.testimonials",
  ],
  craft: [
    "onboarding.pillarSuggestion.craft",
    "onboarding.pillarSuggestion.backstage",
    "onboarding.pillarSuggestion.novelties",
    "onboarding.pillarSuggestion.bespoke",
  ],
  services: [
    "onboarding.pillarSuggestion.expertise",
    "onboarding.pillarSuggestion.caseStudies",
    "onboarding.pillarSuggestion.backstage",
    "onboarding.pillarSuggestion.practicalTips",
  ],
  sport: [
    "onboarding.pillarSuggestion.classes",
    "onboarding.pillarSuggestion.teaching",
    "onboarding.pillarSuggestion.wellbeing",
    "onboarding.pillarSuggestion.studioLife",
  ],
  default: [
    "onboarding.pillarSuggestion.product",
    "onboarding.pillarSuggestion.backstage",
    "onboarding.pillarSuggestion.tips",
    "onboarding.pillarSuggestion.community",
  ],
}

// `labelKey`/`shortKey` = clés i18n ; `value` reste l'identifiant numérique.
export const WEEKDAYS: { value: number; labelKey: MessageKey; shortKey: MessageKey }[] = [
  {
    value: 1,
    labelKey: "onboarding.weekday.mondayLong",
    shortKey: "onboarding.weekday.mondayShort",
  },
  {
    value: 2,
    labelKey: "onboarding.weekday.tuesdayLong",
    shortKey: "onboarding.weekday.tuesdayShort",
  },
  {
    value: 3,
    labelKey: "onboarding.weekday.wednesdayLong",
    shortKey: "onboarding.weekday.wednesdayShort",
  },
  {
    value: 4,
    labelKey: "onboarding.weekday.thursdayLong",
    shortKey: "onboarding.weekday.thursdayShort",
  },
  {
    value: 5,
    labelKey: "onboarding.weekday.fridayLong",
    shortKey: "onboarding.weekday.fridayShort",
  },
  {
    value: 6,
    labelKey: "onboarding.weekday.saturdayLong",
    shortKey: "onboarding.weekday.saturdayShort",
  },
  {
    value: 7,
    labelKey: "onboarding.weekday.sundayLong",
    shortKey: "onboarding.weekday.sundayShort",
  },
]

export function emptyDraft(): ClientDraft {
  return {
    name: "",
    handle: "",
    category: "",
    bio: "",
    timezone: "Europe/Paris",
    brandColor: BRAND_COLORS[0].value,
    accounts: CONNECTABLE_PLATFORMS.map((platform) => ({
      platform,
      username: "",
      connected: false,
    })),
    palette: [BRAND_COLORS[0].value],
    tone: "",
    doList: [],
    dontList: [],
    bannedWords: [],
    pillars: [],
    slots: [],
    approvalMode: "required",
    reviewerEmail: "",
  }
}

// Normalise un handle saisi (retire @, espaces, caractères non autorisés).
export function normalizeHandle(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

// Validation par étape : l'étape 1 est la seule requise (name + handle).
// Comptes, marque et stratégie sont encouragés mais facultatifs.
export function isIdentityValid(draft: ClientDraft): boolean {
  return draft.name.trim().length >= 2 && draft.handle.trim().length >= 2
}

export function pillarShareTotal(pillars: DraftPillar[]): number {
  return pillars.reduce((sum, p) => sum + p.targetShare, 0)
}
