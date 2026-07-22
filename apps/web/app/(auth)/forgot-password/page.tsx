import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.forgot.metaTitle") }
}

export default async function ForgotPasswordPage() {
  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.forgot.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.forgot.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  )
}
