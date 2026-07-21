// Horloge de l'application : vrai temps courant. (Anciennement figée à
// MOCK_NOW pour la preview mockée déterministe ; dégelée au câblage réel.)
// Les helpers de durée/décalage vivaient dans lib/mocks/time (supprimé) : ils
// sont ici car ils font partie du socle permanent, pas des données mockées.

export function now(): Date {
  return new Date()
}

export function nowIso(): string {
  return now().toISOString()
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function hours(n: number): number {
  return n * HOUR
}

export function days(n: number): number {
  return n * DAY
}

/** ISO à `deltaMs` de maintenant. */
export function fromNow(deltaMs: number): string {
  return new Date(now().getTime() + deltaMs).toISOString()
}
