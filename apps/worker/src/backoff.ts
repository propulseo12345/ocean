// Backoff exponentiel + jitter (règle 18). Déterministe SAUF le jitter — le jitter
// reçoit une source aléatoire injectable pour rester testable.

const BASE_MS = 30_000 // 30 s
const CAP_MS = 30 * 60 * 1000 // 30 min

/**
 * Délai avant la prochaine tentative, après `attempts` échecs.
 * exp(attempts) plafonné à 30 min, + jitter [0, 50%] pour désynchroniser.
 */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const exp = Math.min(CAP_MS, BASE_MS * 2 ** Math.max(0, attempts - 1))
  const jitter = exp * 0.5 * random()
  return Math.round(exp + jitter)
}
