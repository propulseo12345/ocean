// Constantes des réglages client (preview). Les teintes de marque sont des
// valeurs oklch prédéfinies (jamais de color picker hex) — appliquées en style
// inline, comme client-avatar.tsx, pour ne hardcoder aucune couleur en classe.

import type { MessageKey } from "@/lib/i18n"

export interface BrandHue {
  /** Valeur oklch appliquée en style inline. */
  value: string
  /** Clé i18n du libellé accessible de la teinte. */
  nameKey: MessageKey
}

// Palette de teintes de marque proposées (couvre les marques des mocks).
export const BRAND_HUES: BrandHue[] = [
  { value: "oklch(0.46 0.09 62)", nameKey: "clientSettings.hues.coffee" },
  { value: "oklch(0.5 0.07 48)", nameKey: "clientSettings.hues.caramel" },
  { value: "oklch(0.55 0.15 30)", nameKey: "clientSettings.hues.brick" },
  { value: "oklch(0.58 0.16 352)", nameKey: "clientSettings.hues.magenta" },
  { value: "oklch(0.56 0.13 292)", nameKey: "clientSettings.hues.lavender" },
  { value: "oklch(0.5 0.14 264)", nameKey: "clientSettings.hues.indigo" },
  { value: "oklch(0.55 0.12 230)", nameKey: "clientSettings.hues.ocean" },
  { value: "oklch(0.53 0.12 150)", nameKey: "clientSettings.hues.forest" },
  { value: "oklch(0.6 0.13 130)", nameKey: "clientSettings.hues.olive" },
  { value: "oklch(0.62 0.14 95)", nameKey: "clientSettings.hues.amber" },
  { value: "oklch(0.45 0.04 250)", nameKey: "clientSettings.hues.slate" },
  { value: "oklch(0.3 0.02 280)", nameKey: "clientSettings.hues.ink" },
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

// Jours ISO (1 = lundi) → clés i18n des libellés court/long pour les créneaux récurrents.
export const WEEKDAY_LABELS: Record<number, { shortKey: MessageKey; longKey: MessageKey }> = {
  1: { shortKey: "clientSettings.weekday.monShort", longKey: "clientSettings.weekday.monLong" },
  2: { shortKey: "clientSettings.weekday.tueShort", longKey: "clientSettings.weekday.tueLong" },
  3: { shortKey: "clientSettings.weekday.wedShort", longKey: "clientSettings.weekday.wedLong" },
  4: { shortKey: "clientSettings.weekday.thuShort", longKey: "clientSettings.weekday.thuLong" },
  5: { shortKey: "clientSettings.weekday.friShort", longKey: "clientSettings.weekday.friLong" },
  6: { shortKey: "clientSettings.weekday.satShort", longKey: "clientSettings.weekday.satLong" },
  7: { shortKey: "clientSettings.weekday.sunShort", longKey: "clientSettings.weekday.sunLong" },
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
