"use client"

import { Building2, LogOut } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"

import { type AuthResult, createOrganization, signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"

export function OnboardingForm() {
  const t = useT()

  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (prev, formData) => {
      const result = await createOrganization(prev, formData)
      if (result?.error) {
        toast.error(t("auth.onboarding.errorTitle"), {
          description:
            result.error === "invalid_org_name"
              ? t("auth.onboarding.invalidNameDetail")
              : t("auth.onboarding.genericDetail"),
        })
      }
      return result
    },
    undefined
  )

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("auth.onboarding.nameLabel")}</Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="organization"
              autoFocus
              required
              maxLength={120}
              placeholder={t("auth.onboarding.namePlaceholder")}
              className="h-10 pl-9"
              aria-invalid={state?.error ? true : undefined}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("auth.onboarding.nameHelp")}</p>
        </div>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending ? t("auth.onboarding.submitting") : t("auth.onboarding.submit")}
        </Button>
      </form>

      {/* Un Reviewer invité sur la MAUVAISE adresse atterrit ici sans rien à y
          faire : sans cette sortie, il serait piégé sur un formulaire de création
          d'agence, avec pour seule issue de vider ses cookies. */}
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
          <LogOut className="size-4" />
          {t("auth.onboarding.signOut")}
        </Button>
      </form>
    </div>
  )
}
