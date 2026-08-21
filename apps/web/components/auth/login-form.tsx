"use client"

import { KeyRound, LogIn, Mail } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"

import { type AuthResult, signInWithPassword } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

/**
 * Message d'état porté par l'URL (P7-2).
 *
 * Le flux d'invitation redirige ici avec `?invite=sent` ou `?error=…`, et la
 * page n'en lisait AUCUN : quelqu'un qui venait d'ouvrir son lien d'invitation
 * voyait un formulaire de connexion nu, sans la moindre indication qu'un e-mail
 * venait de partir. Le plus sûr des flux ne sert à rien s'il est muet.
 */
function useAvis(): { ton: "info" | "erreur"; texte: string } | null {
  const t = useT()
  const params = useSearchParams()

  if (params.get("pending") === "1") {
    return { ton: "info", texte: t("auth.login.signupPending") }
  }
  // Les etats d'invitation (`invite=sent`, `error=invite`,
  // `error=invite_other_account`) ne transitent plus par /login : depuis V-3,
  // c'est la page /invitations qui les affiche, en contexte et sans rediriger.
  // `invite_other_account` etait de toute facon inaffichable — il n'etait
  // atteignable QUE session ouverte, et le proxy intercepte alors /login.
  switch (params.get("error")) {
    case "auth":
      return { ton: "erreur", texte: t("auth.login.authFailed") }
    default:
      return null
  }
}

export function LoginForm() {
  const t = useT()
  const searchParams = useSearchParams()
  const avis = useAvis()
  // Pas de repli sur /dashboard ici : sans `next`, c'est le point unique de
  // resolution de role (P7-5) qui tranche cote serveur.
  const next = searchParams.get("next") ?? ""

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
    undefined
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {avis ? (
        <p
          role="status"
          className={
            avis.ton === "erreur"
              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          }
        >
          {avis.texte}
        </p>
      ) : null}

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("auth.login.forgotLink")}
          </Link>
        </div>
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

      {/* P7-4 : sans ce lien, /signup existe mais reste injoignable depuis l'app. */}
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.login.noAccount")}{" "}
        <Link
          href={routes.signup}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("auth.login.signUpLink")}
        </Link>
      </p>
    </form>
  )
}
