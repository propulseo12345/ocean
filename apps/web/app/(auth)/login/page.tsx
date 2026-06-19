import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Connexion" }

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Accéder à la démo</CardTitle>
        <CardDescription>
          Aperçu produit à données fictives. Entre en un clic, ou simule une connexion sans mot de
          passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
