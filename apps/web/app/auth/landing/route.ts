import { type NextRequest, NextResponse } from "next/server"

import { resolveLanding } from "@/lib/auth/landing"
import { safeNext } from "@/lib/auth/safe-next"
import { siteOrigin } from "@/lib/site-url"

// Point unique de résolution de rôle après authentification (ticket P7-5).
//
// Tout ce qui vient de connecter quelqu'un redirige ICI plutôt que de deviner
// `/dashboard`. On résout l'appartenance réelle (organisation ? client ? aucune)
// et on renvoie vers le bon poste de travail. Chemin public (préfixe /auth du
// proxy) : sans session, `resolveLanding` renvoie `/onboarding`, qui exige une
// session et renverra vers /login — la garde n'est pas ici, elle est dans la DAL.

export async function GET(request: NextRequest) {
  const origin = await siteOrigin()
  const demande = new URL(request.url).searchParams.get("next")

  // Une destination explicite et sûre l'emporte (retour d'invitation, lien
  // profond ouvert avant connexion). `safeNext` la valide — P7-8.
  const cible = demande ? safeNext(demande, await resolveLanding()) : await resolveLanding()

  return NextResponse.redirect(`${origin}${cible}`)
}
