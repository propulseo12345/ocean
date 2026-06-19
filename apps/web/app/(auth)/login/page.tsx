import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.loginPage.metaTitle") }
}

export default async function LoginPage() {
  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.loginPage.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.loginPage.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
