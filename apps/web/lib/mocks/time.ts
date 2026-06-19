// Horloge figée pour des données déterministes (aucun Date.now() au rendu →
// pas de mismatch d'hydratation). "Maintenant" = 11 juin 2026, 10:00 Paris.
export const MOCK_NOW = new Date("2026-06-11T08:00:00.000Z")

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function hours(n: number): number {
  return n * HOUR
}

export function days(n: number): number {
  return n * DAY
}

export function fromNow(deltaMs: number): string {
  return new Date(MOCK_NOW.getTime() + deltaMs).toISOString()
}

/** Jour relatif (offset en jours) à une heure UTC donnée → ISO. */
export function dayAt(dayOffset: number, hourUtc: number, minute = 0): string {
  const base = new Date(MOCK_NOW)
  base.setUTCDate(base.getUTCDate() + dayOffset)
  base.setUTCHours(hourUtc, minute, 0, 0)
  return base.toISOString()
}
