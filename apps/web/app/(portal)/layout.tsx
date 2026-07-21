import { Waves } from "lucide-react"
import type { ReactNode } from "react"
import { LocaleToggle } from "@/components/app/locale-toggle"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { getReviewerContext } from "@/lib/auth/org-context"
import { getT } from "@/lib/i18n/server"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const t = await getT()
  const ctx = await getReviewerContext()
  const client = ctx.clients[0] ?? null
  const reviewer = ctx.reviewer

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Waves className="size-5" />
            </span>
            <span className="font-heading text-lg font-bold">Ocean</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">{t("portal.layout.reviewSpace")}</p>
              {client ? <p className="text-sm font-medium leading-none">{client.name}</p> : null}
            </div>
            {client ? <ClientAvatar client={client} size={32} /> : null}
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          {reviewer ? (
            <span>{t("portal.layout.connectedAs", { name: reviewer.name })}</span>
          ) : (
            <span>{t("portal.layout.reviewSecuredSpace")}</span>
          )}
        </div>
      </footer>
    </div>
  )
}
