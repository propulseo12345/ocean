import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OnboardingForm } from "@/components/auth/onboarding-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { verifySession } from "@/lib/auth/dal"
import { resolveLanding } from "@/lib/auth/landing"
import { getT } from "@/lib/i18n/server"

// Ticket P7-3 — cette route N'EXISTAIT PAS.
//
// `getActiveOrg` (lib/auth/org-context.ts:79) y renvoie tout compte sans
// organisation. C'est le cas de TOUT Reviewer, par construction : il ne possède
// qu'une ligne `client_members`. Chaque connexion d'un client se terminait donc
// sur un 404 nu — sur le parcours que le produit vend comme argument commercial.
//
// La page ne se contente pas d'afficher un formulaire : elle re-résout d'abord
// la destination. Un Reviewer qui atterrit ici (lien direct, retour d'email) doit
// filer au portail, pas se voir proposer de créer une agence.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.onboarding.metaTitle") }
}

export default async function OnboardingPage() {
  const user = await verifySession()
  if (!user) redirect("/login?next=/onboarding")

  // Déjà rattaché quelque part ? On n'a rien à demander.
  const landing = await resolveLanding()
  if (landing !== "/onboarding") redirect(landing)

  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.onboarding.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.onboarding.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm />
      </CardContent>
    </Card>
  )
}
