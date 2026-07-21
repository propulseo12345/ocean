"use client"

import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Smartphone,
  Sun,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { signOut } from "@/app/(auth)/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { User } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { useShell } from "./shell/shell-provider"

export function NavUser({ user }: { user: User }) {
  const t = useT()
  const { setTheme } = useTheme()
  const { setPwaGuideOpen } = useShell()
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
                <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-xs font-semibold text-sidebar-primary-foreground">
                  {user.initials}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
                </span>
                <ChevronsUpDown className="ml-auto size-4 opacity-70" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="end" side="top" className="min-w-60">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={routes.settings} />} className="gap-2">
                <Settings className="size-4" />
                {t("nav.item.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={routes.notifications} />} className="gap-2">
                <Bell className="size-4" />
                {t("nav.item.notifications")}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setPwaGuideOpen(true)}>
                <Smartphone className="size-4" />
                {t("nav.user.installApp")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("nav.user.theme")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("light")}>
                <Sun className="size-4" />
                {t("nav.user.themeLight")}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("dark")}>
                <Moon className="size-4" />
                {t("nav.user.themeDark")}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("system")}>
                <Monitor className="size-4" />
                {t("nav.user.themeSystem")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem
                render={<button type="submit" className="w-full" />}
                className="gap-2"
              >
                <LogOut className="size-4" />
                {t("nav.user.logout")}
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
