import type { ApprovalMode, Platform } from "@/lib/mocks/types"

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
export const CATEGORIES = [
  "Restaurant / Café",
  "Mode / Boutique",
  "Beauté / Bien-être",
  "Artisan / Atelier",
  "Services / Conseil",
  "Sport / Studio",
  "Immobilier",
  "Santé",
  "Association / Culture",
  "Autre",
] as const

// Fuseaux courants côté clients FR + DOM-TOM (le freelance garde le sien).
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Europe/Paris", label: "Europe/Paris (métropole)" },
  { value: "Europe/Brussels", label: "Europe/Bruxelles" },
  { value: "Europe/Luxembourg", label: "Europe/Luxembourg" },
  { value: "Indian/Reunion", label: "La Réunion (UTC+4)" },
  { value: "America/Martinique", label: "Martinique (UTC−4)" },
  { value: "America/Guadeloupe", label: "Guadeloupe (UTC−4)" },
  { value: "America/Cayenne", label: "Guyane (UTC−3)" },
  { value: "Pacific/Tahiti", label: "Tahiti (UTC−10)" },
  { value: "America/Montreal", label: "Montréal (UTC−4/−5)" },
]

// Tons éditoriaux proposés (BrandKit.tone résumé en une phrase à l'usage réel).
export const TONES = [
  "Chaleureux & proche",
  "Professionnel & posé",
  "Décontracté & spontané",
  "Premium & raffiné",
  "Engagé & militant",
  "Pédagogique & rassurant",
] as const

// Palette de teintes de marque (oklch) — cliquables, jamais de picker hex.
// Couleurs lisibles en avatar (texte blanc) dans les deux thèmes.
export const BRAND_COLORS: { value: string; label: string }[] = [
  { value: "oklch(0.46 0.09 62)", label: "Café" },
  { value: "oklch(0.53 0.12 150)", label: "Vert" },
  { value: "oklch(0.58 0.16 352)", label: "Rose" },
  { value: "oklch(0.56 0.13 292)", label: "Violet" },
  { value: "oklch(0.55 0.15 25)", label: "Corail" },
  { value: "oklch(0.55 0.13 235)", label: "Bleu" },
  { value: "oklch(0.6 0.12 200)", label: "Cyan" },
  { value: "oklch(0.58 0.11 145)", label: "Émeraude" },
  { value: "oklch(0.6 0.13 85)", label: "Ambre" },
  { value: "oklch(0.5 0.07 48)", label: "Terre" },
  { value: "oklch(0.5 0.05 280)", label: "Ardoise" },
  { value: "oklch(0.45 0.02 250)", label: "Graphite" },
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
export const PILLAR_SUGGESTIONS: Record<string, string[]> = {
  "Restaurant / Café": ["Produit & menu", "Coulisses", "Avis clients", "Événements"],
  "Mode / Boutique": ["Collection", "Lookbook & styling", "Atelier", "Communauté & UGC"],
  "Beauté / Bien-être": ["Soins & produits", "Conseils", "Avant / après", "Témoignages"],
  "Artisan / Atelier": ["Savoir-faire", "Coulisses", "Nouveautés", "Sur-mesure"],
  "Services / Conseil": ["Expertise", "Cas clients", "Coulisses", "Conseils pratiques"],
  "Sport / Studio": ["Cours & ateliers", "Pédagogie", "Bien-être", "Vie du studio"],
  default: ["Produit", "Coulisses", "Conseils", "Communauté"],
}

export const WEEKDAYS = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
] as const

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
