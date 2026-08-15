// La RÈGLE d'aiguillage après authentification (ticket P7-5), isolée de toute
// I/O — et surtout de `server-only`, qui rendrait ce fichier inexécutable hors
// du runtime Next, donc intestable. `landing.ts` l'utilise et fournit les
// comptages ; ici on ne fait que trancher.

/** Les trois destinations possibles après authentification. */
export type Landing = "/dashboard" | "/portal" | "/onboarding"

/**
 * Où va cette personne ?
 *
 * L'ordre n'est pas arbitraire : un propriétaire d'organisation peut aussi être
 * reviewer sur l'un de ses propres clients (c'est même le cas d'Étienne en phase
 * solo). Dans ce cas l'agence prime — le portail reste accessible, mais ce n'est
 * pas son poste de travail.
 *
 * Ni org ni client : compte tout neuf, ou reviewer dont l'adhésion vient d'être
 * révoquée. `/onboarding` lui propose de créer son organisation. Avant P7-3
 * cette route n'existait pas : c'était un 404 nu, et c'est là que tombait TOUT
 * reviewer à chaque connexion.
 */
export function landingFor(appartenances: {
  orgMemberships: number
  clientMemberships: number
}): Landing {
  if (appartenances.orgMemberships > 0) return "/dashboard"
  if (appartenances.clientMemberships > 0) return "/portal"
  return "/onboarding"
}
