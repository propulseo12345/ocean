import type { Metadata } from "next"

import { SignupForm } from "@/components/auth/signup-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"

// Ticket P7-4 — cette route n'existait pas.
//
// `signUpWithPassword` est écrite depuis le début, complète et validée Zod, et
// n'avait **aucun appelant** : il était impossible de créer un compte autrement
// qu'en écrivant dans `auth.users` à la main. C'est aussi ce qui rendait le
// critère de sortie de la phase 7 inatteignable — il commence par « depuis un
// compte neuf ».

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.signup.metaTitle") }
}

export default async function SignupPage() {
  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.signup.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.signup.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  )
}
