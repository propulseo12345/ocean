"use client"

import { KeyRound, LogIn, Mail } from "lucide-react"
import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { signInWithPassword, type AuthResult } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"

export function LoginForm() {
  const t = useT()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/dashboard"

  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (prev, formData) => {
      const result = await signInWithPassword(prev, formData)
      if (result?.error) {
        toast.error(t("auth.login.invalidCredentialsTitle"), {
          description: t("auth.login.invalidCredentialsDetail"),
        })
      }
      return result
    },
    undefined,
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder={t("auth.login.emailPlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            placeholder={t("auth.login.passwordPlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        <LogIn />
        {pending ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
    </form>
  )
}
