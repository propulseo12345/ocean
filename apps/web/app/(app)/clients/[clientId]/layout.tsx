import { Clock, Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { ClientTabs } from "@/components/app/client-tabs"
import { ClientHealthBanner } from "@/components/app/shell/client-health-banner"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { getT } from "@/lib/i18n/server"
import { getClient, getSocialAccounts } from "@/lib/mocks"
import { routes } from "@/lib/routes"

export default async function ClientLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const t = await getT()
  const client = getClient(clientId)
  if (!client) notFound()
  const accounts = getSocialAccounts(clientId)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex">
            <ClientAvatar client={client} size={48} className="rounded-xl" />
            {accounts.some((a) => a.status !== "connected") ? (
              <span
                title={t("clients.accountToReconnect")}
                className="absolute -top-1 -right-1 size-3 rounded-full bg-destructive ring-2 ring-background"
              >
                <span className="sr-only">{t("clients.accountToReconnect")}</span>
              </span>
            ) : null}
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold leading-tight">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>@{client.handle}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {client.timezone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {accounts.map((a) => (
                  <PlatformIcon key={a.id} platform={a.platform} className="size-3.5" />
                ))}
              </span>
            </div>
          </div>
        </div>
        <Button render={<Link href={routes.contentNew(client.id)} />}>
          <Plus />
          {t("clients.newContent")}
        </Button>
      </div>

      <ClientHealthBanner clientId={client.id} />

      <ClientTabs clientId={client.id} />
      <div>{children}</div>
    </div>
  )
}
