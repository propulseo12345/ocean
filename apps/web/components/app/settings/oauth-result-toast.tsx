"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"

// Rend le résultat du callback OAuth (?connected=<provider> / ?error=<code>) en
// toast, puis nettoie l'URL. Le flux réel se fait par redirection HTTP (Route
// Handler) : ce composant ne fait qu'afficher l'issue et retirer les query params.

const PROVIDER_LABEL: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  google: "Google",
  microsoft: "Microsoft",
}

export function OAuthResultToast() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fired = useRef(false)

  const connected = params.get("connected")
  const error = params.get("error")

  useEffect(() => {
    if (fired.current) return
    if (!connected && !error) return
    fired.current = true

    if (connected) {
      toast.success(
        t("settings.accounts.connectedToast", {
          provider: PROVIDER_LABEL[connected] ?? connected,
        })
      )
    } else if (error) {
      const description =
        error === "oauth_unconfigured"
          ? t("settings.accounts.errorUnconfigured")
          : error === "denied"
            ? t("settings.accounts.errorDenied")
            : t("settings.accounts.errorGeneric")
      toast.error(t("settings.accounts.connectErrorTitle"), { description })
    }

    router.replace(pathname, { scroll: false })
  }, [connected, error, pathname, router, t])

  return null
}
