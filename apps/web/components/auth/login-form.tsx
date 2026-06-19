"use client"

import { KeyRound, Mail, Monitor, Smartphone, Waves } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Compte de démonstration pré-rempli : tout est fictif, aucun envoi réel.
const DEMO_EMAIL = "demo@studio.fr"

export function LoginForm() {
  const router = useRouter()
  const t = useT()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const isValid = EMAIL_RE.test(email)

  function enterDemo() {
    toast.success(t("auth.login.demoToastTitle"), {
      description: t("auth.login.demoToastDetail"),
    })
    router.push(routes.dashboard)
  }

  function guard() {
    if (!isValid) {
      toast.error(t("auth.login.invalidEmailTitle"), {
        description: t("auth.login.invalidEmailDetail"),
      })
      return false
    }
    return true
  }

  function sendMagicLink() {
    if (!guard()) return
    toast.success(t("auth.login.magicLinkToastTitle"), {
      description: t("auth.login.magicLinkToastDetail", { email }),
    })
    router.push(routes.dashboard)
  }

  function sendOtp() {
    if (!guard()) return
    toast.success(t("auth.login.otpToastTitle"), {
      description: t("auth.login.otpToastDetail"),
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
        {t("auth.login.enterDemo")}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("auth.login.orSimulate")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder={t("auth.login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={email.length > 0 && !isValid}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="h-10 w-full">
          <Mail />
          {t("auth.login.sendMagicLink")}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-10 w-full" onClick={sendOtp}>
          <KeyRound />
          {t("auth.login.sendOtp")}
        </Button>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Monitor className="size-3.5 shrink-0 text-foreground" />
          {t("auth.login.hintDesktopPrefix")}
          <strong className="font-medium text-foreground">{t("auth.login.hintDesktopBold")}</strong>
          {t("auth.login.hintDesktopSuffix")}
        </p>
        <p className="flex items-center gap-2">
          <Smartphone className="size-3.5 shrink-0 text-foreground" />
          {t("auth.login.hintMobilePrefix")}
          <strong className="font-medium text-foreground">{t("auth.login.hintMobileBold")}</strong>
          {t("auth.login.hintMobileSuffix")}
        </p>
      </div>
    </form>
  )
}
