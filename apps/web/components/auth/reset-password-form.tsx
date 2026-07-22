"use client"

import { KeyRound, Save } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"

import { type AuthResult, updatePassword } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"

// Choix du nouveau mot de passe. La session de récupération a été établie par
// /auth/callback. updatePassword redirige vers /dashboard en cas de succès.

export function ResetPasswordForm() {
  const t = useT()

  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (prev, formData) => {
      const result = await updatePassword(prev, formData)
      if (result?.error) {
        toast.error(t("auth.reset.errorTitle"), {
          description:
            result.error === "weak_password"
              ? t("auth.reset.weakPasswordDetail")
              : t("auth.reset.genericDetail"),
        })
      }
      return result
    },
    undefined,
  )

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.reset.passwordLabel")}</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            placeholder={t("auth.reset.passwordPlaceholder")}
            className="h-10 pl-9"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        <Save />
        {pending ? t("auth.reset.submitting") : t("auth.reset.submit")}
      </Button>
    </form>
  )
}
