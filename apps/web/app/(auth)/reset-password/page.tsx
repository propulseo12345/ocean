import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.reset.metaTitle") }
}

export default async function ResetPasswordPage() {
  // La session de récupération doit exister (posée par /auth/callback). Sans
  // elle, on renvoie vers la demande de lien plutôt que d'afficher un formulaire
  // qui échouerait à l'envoi.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/forgot-password")

  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.reset.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.reset.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  )
}
