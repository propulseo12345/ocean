// Ocean — types de pilotage pro : piliers éditoriaux, événements client,
// créneaux récurrents, brand kit, vues enregistrées et quotas plateformes.

import type { L } from "@/lib/i18n/localized"
import type { ContentFormat, ContentStatus, Platform } from "./core"

/** Pilier éditorial d'un client (« Coulisses », « Produit »…). */
export interface ContentPillar {
  id: string
  clientId: string
  name: L<string>
  /** Couleur via variable de thème, ex. "var(--chart-2)". */
  colorVar: string
  /** Part cible dans le mix éditorial, en % (la somme par client ≈ 100). */
  targetShare: number
}

export type ClientEventKind = "note" | "event"

/** Note ou événement client affiché dans le calendrier éditorial. */
export interface ClientEvent {
  id: string
  clientId: string
  /** ISO UTC (l'affichage se fait dans le fuseau du client). */
  date: string
  title: L<string>
  kind: ClientEventKind
}

/** Créneau de publication récurrent convenu avec le client. */
export interface RecurringSlot {
  id: string
  clientId: string
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  weekday: number
  /** Heure locale du client, format "HH:mm". */
  time: string
  platforms: Platform[]
  pillarId?: string
}

/** Identité de marque du client — garde-fous de rédaction inclus. */
export interface BrandKit {
  clientId: string
  /** Couleurs de marque en valeurs oklch (affichées en pastilles). */
  palette: string[]
  /** Ton de voix résumé en une phrase. */
  tone: L<string>
  doList: L<string>[]
  dontList: L<string>[]
  /** Mots/termes interdits, détectés par lib/caption.ts (proper nouns, non traduits). */
  bannedWords: string[]
}

/** Filtres d'une vue enregistrée du studio. */
export interface SavedViewFilters {
  statuses?: ContentStatus[]
  platforms?: Platform[]
  formats?: ContentFormat[]
  labels?: string[]
  pillarIds?: string[]
  search?: string
}

/** Vue filtrée enregistrée (studio). */
export interface SavedView {
  id: string
  clientId: string
  name: L<string>
  filters: SavedViewFilters
}

/** Consommation d'un quota plateforme pour un compte social. */
export interface QuotaUsage {
  used: number
  limit: number
  /** Clé i18n de la fenêtre de quota, ex. "publications · 24 h". */
  windowKey: import("@/lib/i18n").MessageKey
}
