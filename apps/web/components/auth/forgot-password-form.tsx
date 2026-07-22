"use client"

import { MailCheck, Send } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"

import { type AuthResult, requestPasswordReset } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"

// Demande d'un lien de réinitialisation. Le succès est GÉNÉRIQUE (anti-
// énumération de comptes) : on affiche toujours le même message d'envoi.

type State = { sent: boolean; error?: string }

export function ForgotPasswordForm() {
  const t = useT()

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result: AuthResult = await requestPasswordReset(undefined, formData)
      if (result?.error) return { sent: false, error: result.error }
      return { sent: true }
    },
    { sent: false },
  )

  if (state.sent) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-foreground">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-success" />
          {t("auth.forgot.sentDescription")}
        </p>
        <Button variant="outline" className="w-full" render={<Link href="/login" />}>
          {t("auth.forgot.backToLogin")}
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.forgot.emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder={t("auth.forgot.emailPlaceholder")}
          className="h-10"
          aria-invalid={state.error ? true : undefined}
        />
        {state.error ? (
          <p className="text-xs text-destructive">{t("auth.forgot.invalidEmail")}</p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        <Send />
        {pending ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
      </Button>

      <Button variant="ghost" className="w-full" render={<Link href="/login" />}>
        {t("auth.forgot.backToLogin")}
      </Button>
    </form>
  )
}
