import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { OtpForm } from "@/components/auth/otp-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { routes } from "@/lib/routes"

export const metadata: Metadata = { title: "Vérification" }

export default function OtpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entre ton code</CardTitle>
        <CardDescription>Saisis le code à 6 chiffres envoyé à ton adresse e-mail.</CardDescription>
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
          Changer d'adresse e-mail
        </Button>
      </CardContent>
    </Card>
  )
}
