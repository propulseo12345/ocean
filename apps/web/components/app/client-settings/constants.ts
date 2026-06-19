// Constantes des réglages client (preview). Les teintes de marque sont des
// valeurs oklch prédéfinies (jamais de color picker hex) — appliquées en style
// inline, comme client-avatar.tsx, pour ne hardcoder aucune couleur en classe.

export interface BrandHue {
  /** Valeur oklch appliquée en style inline. */
  value: string
  /** Libellé accessible de la teinte. */
  name: string
}

// Palette de teintes de marque proposées (couvre les marques des mocks).
export const BRAND_HUES: BrandHue[] = [
  { value: "oklch(0.46 0.09 62)", name: "Terre de café" },
  { value: "oklch(0.5 0.07 48)", name: "Caramel" },
  { value: "oklch(0.55 0.15 30)", name: "Brique" },
  { value: "oklch(0.58 0.16 352)", name: "Magenta" },
  { value: "oklch(0.56 0.13 292)", name: "Lavande" },
  { value: "oklch(0.5 0.14 264)", name: "Indigo" },
  { value: "oklch(0.55 0.12 230)", name: "Océan" },
  { value: "oklch(0.53 0.12 150)", name: "Vert forêt" },
  { value: "oklch(0.6 0.13 130)", name: "Olive" },
  { value: "oklch(0.62 0.14 95)", name: "Ambre" },
  { value: "oklch(0.45 0.04 250)", name: "Ardoise" },
  { value: "oklch(0.3 0.02 280)", name: "Encre" },
]

// Teintes de palette du brand kit (éditeur — ajout/suppression de pastilles).
export const PALETTE_SWATCHES: string[] = [
  "oklch(0.46 0.09 62)",
  "oklch(0.72 0.08 70)",
  "oklch(0.95 0.02 80)",
  "oklch(0.53 0.12 150)",
  "oklch(0.85 0.06 140)",
  "oklch(0.35 0.05 155)",
  "oklch(0.58 0.16 352)",
  "oklch(0.9 0.04 60)",
  "oklch(0.56 0.13 292)",
  "oklch(0.4 0.08 295)",
  "oklch(0.45 0.04 250)",
  "oklch(0.3 0.02 280)",
]

// Jours ISO (1 = lundi) → libellés courts FR pour les créneaux récurrents.
export const WEEKDAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: "Lun", long: "Lundi" },
  2: { short: "Mar", long: "Mardi" },
  3: { short: "Mer", long: "Mercredi" },
  4: { short: "Jeu", long: "Jeudi" },
  5: { short: "Ven", long: "Vendredi" },
  6: { short: "Sam", long: "Samedi" },
  7: { short: "Dim", long: "Dimanche" },
}

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const

// Seuils de cadence par défaut (réglables, mock).
export const CADENCE_DEFAULTS = {
  /** Alerter si aucun post planifié pendant N jours. */
  gapDays: 7,
  /** Avertir au-delà de N posts le même jour. */
  maxPerDay: 2,
} as const

export const GAP_BOUNDS = { min: 2, max: 21 } as const
export const DENSITY_BOUNDS = { min: 1, max: 6 } as const

// Délai de grâce de la corbeille avant purge des médias (PRD §5.A/J).
export const TRASH_GRACE_DAYS = 30

// Délai de relance automatique du reviewer (réglage mock, J+N sans réponse).
export const REMINDER_DELAY_DEFAULT = 2
export const REMINDER_DELAY_BOUNDS = { min: 1, max: 7 } as const
