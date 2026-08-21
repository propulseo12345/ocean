import "server-only"

import { createClient } from "@/lib/supabase/server"
import { verifySession } from "./dal"
import { type Landing, landingFor } from "./landing-rule"

// Où atterrit un compte qui vient de s'authentifier (ticket P7-5).
//
// LE DÉFAUT
// ---------
// `/dashboard` était écrit EN DUR à quatre endroits : le proxy (qui y renvoyait
// tout utilisateur connecté arrivant sur /login, en effaçant `next` au passage),
// `signInWithPassword`, `signUpWithPassword` et `updatePassword`. Or un Reviewer
// n'a rien à faire sur `/dashboard` : il n'appartient à aucune organisation, donc
// `getActiveOrg` le renvoyait aussitôt sur `/onboarding` — qui n'existait pas
// (P7-3). Résultat : un 404 nu à chaque connexion, pour le seul rôle que le
// produit vend comme argument commercial.
//
// LA RÈGLE
// --------
// Un seul endroit répond à « où va cette personne ». Les appelants ne devinent
// plus : ils redirigent vers `/auth/landing`. Ajouter un rôle demain se fait
// dans `landing-rule.ts`, pas à quatre endroits.

export type { Landing }
export { landingFor }

/**
 * Résout la destination du compte authentifié courant.
 *
 * `head: true` + `count: "exact"` : on ne rapatrie aucune ligne, seulement le
 * nombre — c'est un aiguillage, pas un chargement de données. La RLS fait le
 * reste : chaque compte ne compte que ses propres appartenances.
 */
export async function resolveLanding(): Promise<Landing> {
  const user = await verifySession()
  if (!user) return "/onboarding"

  const supabase = await createClient()

  const [orgs, clients] = await Promise.all([
    supabase
      .from("organization_members")
      .select("org_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("client_members")
      .select("client_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ])

  return landingFor({
    orgMemberships: orgs.count ?? 0,
    clientMemberships: clients.count ?? 0,
  })
}
