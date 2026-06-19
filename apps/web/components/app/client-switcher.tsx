"use client"

import { Building2, Check, ChevronsUpDown, LayoutGrid } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClientAvatar } from "@/components/shared/client-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { getClients } from "@/lib/mocks"
import type { Client } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { activeClientIdFromPath, clientAccountIssues, clientSwitchHref } from "./shell/client-nav"
import { useShell } from "./shell/shell-provider"

// Switcher de client contextuel : récents en tête, pastille santé par client,
// bascule en conservant la sous-page courante (grille → grille, calendrier →
// calendrier…).

function HealthDot({ ring }: { ring: "popover" | "sidebar" }) {
  return (
    <span
      title="Un compte est à reconnecter"
      className={`absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ${
        ring === "popover" ? "ring-popover" : "ring-sidebar"
      }`}
    >
      <span className="sr-only">Un compte est à reconnecter</span>
    </span>
  )
}

function SwitcherItem({
  client,
  pathname,
  activeId,
}: {
  client: Client
  pathname: string
  activeId: string | undefined
}) {
  const hasIssue = clientAccountIssues(client.id).length > 0
  return (
    <DropdownMenuItem
      render={<Link href={clientSwitchHref(pathname, client.id)} />}
      className="gap-2"
    >
      <span className="relative inline-flex">
        <ClientAvatar client={client} size={22} />
        {hasIssue ? <HealthDot ring="popover" /> : null}
      </span>
      <span className="flex-1 truncate">{client.name}</span>
      {client.id === activeId ? <Check className="size-4" /> : null}
    </DropdownMenuItem>
  )
}

export function ClientSwitcher() {
  const pathname = usePathname()
  const { recentClientIds } = useShell()
  const clients = getClients()
  const activeId = activeClientIdFromPath(pathname)
  const active = clients.find((c) => c.id === activeId)
  const activeHasIssue = active ? clientAccountIssues(active.id).length > 0 : false

  const recents = recentClientIds
    .map((id) => clients.find((c) => c.id === id))
    .filter((c): c is Client => c !== undefined)
  const others = clients.filter((c) => !recentClientIds.includes(c.id))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {active ? (
                  <span className="relative inline-flex">
                    <ClientAvatar client={active} size={28} />
                    {activeHasIssue ? <HealthDot ring="sidebar" /> : null}
                  </span>
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <Building2 className="size-4" />
                  </span>
                )}
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-xs text-sidebar-foreground/60">Espace client</span>
                  <span className="truncate font-medium">
                    {active ? active.name : "Tous les espaces"}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-4 opacity-70" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="min-w-60">
            {recents.length > 0 ? (
              <>
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Récents
                </DropdownMenuLabel>
                {recents.map((c) => (
                  <SwitcherItem key={c.id} client={c} pathname={pathname} activeId={activeId} />
                ))}
                {others.length > 0 ? <DropdownMenuSeparator /> : null}
              </>
            ) : null}
            {others.length > 0 ? (
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {recents.length > 0 ? "Autres espaces" : "Espaces clients"}
              </DropdownMenuLabel>
            ) : null}
            {others.map((c) => (
              <SwitcherItem key={c.id} client={c} pathname={pathname} activeId={activeId} />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href={routes.clients} />}
              className="gap-2 text-muted-foreground"
            >
              <LayoutGrid className="size-4" />
              Tous les clients
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
