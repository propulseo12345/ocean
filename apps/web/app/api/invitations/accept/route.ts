import { type NextRequest, NextResponse } from "next/server"

import { routes } from "@/lib/routes"
import { siteOrigin } from "@/lib/site-url"

// Ancien point d'acceptation d'invitation — désormais SANS AUCUN EFFET DE BORD.
//
// CE QUE CETTE ROUTE FAISAIT, ET POURQUOI ELLE NE LE FAIT PLUS
// ------------------------------------------------------------
// C'était un GET qui écrivait : il créait l'adhésion `client_members` en
// service_role (donc hors RLS) et envoyait des e-mails. Deux failles en
// découlaient directement (ticket V-3) :
//
//   * CSRF. Aucun contrôle `Origin` / `Sec-Fetch-Site` / `Referer`, aucun jeton
//     anti-CSRF, sur des cookies `SameSite=Lax` (défaut de `@supabase/ssr`,
//     jamais surchargé). Une navigation top-level depuis un site tiers emportait
//     donc la session de la VICTIME : l'attaquant créait une org, un client,
//     invitait `victime@x` — `inviteReviewer` lui rend le jeton EN CLAIR — et
//     faisait ouvrir le lien. `sameAddress` passait, puisque l'invitation visait
//     justement l'adresse de la victime. Gain réel :
//     `private.shares_scope_with` devenait vraie, donc `profiles_select_shared`
//     ouvrait à l'attaquant la ligne `profiles` de la victime.
//   * Émetteur d'e-mails non authentifié et non plafonné. Sans session, la route
//     appelait `sendProofOfPossession` AVANT toute authentification, et le jeton
//     étant délibérément rejouable (P7-2), chaque rejeu déclenchait un envoi
//     vers une adresse choisie par l'attaquant.
//
// Elle ne subsiste que pour ne pas casser les liens DÉJÀ PARTIS par e-mail : on
// redirige vers la page de confirmation, qui décrit l'invitation et exige un
// POST explicite. Le jeton n'est ni lu, ni consommé, ni validé ici.
//
// ⚠️ Ne jamais y remettre d'écriture. Si ce fichier redevient un jour un point
// d'acceptation, les deux failles ci-dessus rouvrent le même jour.

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")
  const origin = await siteOrigin()

  return NextResponse.redirect(`${origin}${routes.acceptInvite(token ?? "")}`)
}
