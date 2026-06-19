import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { OtpForm } from "@/components/auth/otp-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("auth.otpPage.metaTitle") }
}

export default async function OtpPage() {
  const t = await getT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.otpPage.cardTitle")}</CardTitle>
        <CardDescription>{t("auth.otpPage.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OtpForm />
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-muted-foreground"
          render={<Link href={routes.login} />}
        >
          <ArrowLeft />
          {t("auth.otpPage.changeEmail")}
        </Button>
      </CardContent>
    </Card>
  )
}
