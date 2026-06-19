import type { Locale } from "./config"

// Contenu de démonstration bilingue : un champ qui existe en FR et EN.
// Utilisé pour les mocks (noms de clients, bios, légendes, notes…), résolu à
// l'affichage via pick() avec la locale active.
export type L<T = string> = { fr: T; en: T }

export function pick<T>(value: L<T>, locale: Locale): T {
  return value[locale]
}

// Helper de construction concis pour les mocks.
export function loc<T>(fr: T, en: T): L<T> {
  return { fr, en }
}
