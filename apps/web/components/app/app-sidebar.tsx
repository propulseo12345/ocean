"use client"

import { Bell, CalendarDays, LayoutDashboard, Search, Settings, Users, Waves } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClientAvatar } from "@/components/shared/client-avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n"
import type { Client, SocialAccount, User } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { ClientSwitcher } from "./client-switcher"
import { NavUser } from "./nav-user"
import { clientAccountIssues, clientSwitchHref } from "./shell/client-nav"
import { useShell } from "./shell/shell-provider"

const NAV = [
  { titleKey: "nav.item.dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { titleKey: "nav.item.agenda", href: routes.agenda, icon: CalendarDays },
  { titleKey: "nav.item.notifications", href: routes.notifications, icon: Bell },
  { titleKey: "nav.item.clients", href: routes.clients, icon: Users },
] as const

export function AppSidebar({
  clients,
  currentUser,
  socialAccounts,
}: {
  clients: Client[]
  currentUser: User
  socialAccounts: SocialAccount[]
}) {
  const t = useT()
  const pathname = usePathname()
  const { setPaletteOpen } = useShell()
  const isActive = (href: string) =>
    href === routes.dashboard
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar>
      <SidebarHeader className="gap-2">
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Waves className="size-5" />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight">Ocean</span>
        </div>
        <ClientSwitcher clients={clients} socialAccounts={socialAccounts} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("nav.searchAria")} onClick={() => setPaletteOpen(true)}>
              <Search />
              <span className="text-sidebar-foreground/70">{t("nav.searchPlaceholder")}</span>
              <kbd className="ml-auto inline-flex h-5 items-center rounded border bg-sidebar px-1.5 font-sans text-[10px] font-medium text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.groupPilotage")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={t(item.titleKey)}
                    render={
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                      />
                    }
                  >
                    <item.icon />
                    <span>{t(item.titleKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.groupClientSpaces")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {clients.map((c) => {
                const active = pathname.startsWith(routes.client(c.id))
                const hasIssue = clientAccountIssues(socialAccounts, c.id).length > 0
                return (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={c.name}
                      render={
                        <Link
                          href={clientSwitchHref(pathname, c.id)}
                          aria-current={active ? "page" : undefined}
                        />
                      }
                    >
                      <span className="relative inline-flex">
                        <ClientAvatar client={c} size={20} />
                        {hasIssue ? (
                          <span
                            title={t("nav.accountReconnect")}
                            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar"
                          />
                        ) : null}
                      </span>
                      <span className="truncate">{c.name}</span>
                      {hasIssue ? (
                        <span className="sr-only">{t("nav.accountReconnectDash")}</span>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive(routes.settings)}
              tooltip={t("nav.item.settings")}
              render={
                <Link
                  href={routes.settings}
                  aria-current={isActive(routes.settings) ? "page" : undefined}
                />
              }
            >
              <Settings />
              <span>{t("nav.item.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
