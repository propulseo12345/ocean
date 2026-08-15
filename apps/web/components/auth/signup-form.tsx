"use client"

import { KeyRound, Mail, UserPlus, UserRound } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"
import { toast } from "sonner"

import { type AuthResult, signUpWithPassword } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

export function SignupForm() {
  const t = useT()

  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (prev, formData) => {
      const result = await signUpWithPassword(prev, formData)
      if (result?.error) {
        toast.error(t("auth.signup.errorTitle"), {
          description:
            result.error === "invalid_signup_format"
              ? t("auth.signup.invalidFormatDetail")
              : t("auth.signup.genericDetail"),
        })
      }
      return result
    },
    undefined
  )

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("auth.signup.nameLabel")}</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            autoFocus
            required
            maxLength={120}
            placeholder={t("auth.signup.namePlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
        {/* Le nom sert aussi de nom d'organisation par defaut (create_organization). */}
        <p className="text-xs text-muted-foreground">{t("auth.signup.nameHelp")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.signup.emailLabel")}</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t("auth.signup.emailPlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.signup.passwordLabel")}</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder={t("auth.signup.passwordPlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("auth.signup.passwordHelp")}</p>
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        <UserPlus />
        {pending ? t("auth.signup.submitting") : t("auth.signup.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.signup.haveAccount")}{" "}
        <Link
          href={routes.login}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("auth.signup.signInLink")}
        </Link>
      </p>
    </form>
  )
}
