"use client"

import { KeyRound, Mail, Monitor, Smartphone, Waves } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { routes } from "@/lib/routes"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Compte de démonstration pré-rempli : tout est fictif, aucun envoi réel.
const DEMO_EMAIL = "demo@studio.fr"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const isValid = EMAIL_RE.test(email)

  function enterDemo() {
    toast.success("Bienvenue dans la démo Ocean", {
      description: "Compte de démonstration — données fictives.",
    })
    router.push(routes.dashboard)
  }

  function guard() {
    if (!isValid) {
      toast.error("Adresse e-mail invalide", {
        description: "Saisis une adresse valide pour continuer.",
      })
      return false
    }
    return true
  }

  function sendMagicLink() {
    if (!guard()) return
    toast.success("Lien magique validé (preview)", {
      description: `Connexion simulée pour ${email} — accès à la démo.`,
    })
    router.push(routes.dashboard)
  }

  function sendOtp() {
    if (!guard()) return
    toast.success("Code envoyé (preview)", {
      description: "Action simulée — saisis un code de 6 chiffres au choix.",
    })
    router.push(routes.otp)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        sendMagicLink()
      }}
      className="space-y-4"
    >
      <Button type="button" size="lg" className="h-11 w-full" onClick={enterDemo}>
        <Waves />
        Entrer dans la démo
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou simule une connexion
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="toi@studio.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={email.length > 0 && !isValid}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="h-10 w-full">
          <Mail />
          Recevoir le lien magique
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-10 w-full" onClick={sendOtp}>
          <KeyRound />
          Recevoir un code à 6 chiffres
        </Button>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Monitor className="size-3.5 shrink-0 text-foreground" />
          Sur ordinateur, le <strong className="font-medium text-foreground">lien magique</strong>{" "}
          est le plus simple.
        </p>
        <p className="flex items-center gap-2">
          <Smartphone className="size-3.5 shrink-0 text-foreground" />
          Sur mobile, préfère le{" "}
          <strong className="font-medium text-foreground">code à 6 chiffres</strong>.
        </p>
      </div>
    </form>
  )
}
