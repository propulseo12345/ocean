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
import { CURRENT_USER } from "@/lib/mocks"
import { routes } from "@/lib/routes"
import { useShell } from "./shell/shell-provider"

export function NavUser() {
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
                  {CURRENT_USER.initials}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{CURRENT_USER.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {CURRENT_USER.email}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-4 opacity-70" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="end" side="top" className="min-w-60">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {CURRENT_USER.email}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={routes.settings} />} className="gap-2">
                <Settings className="size-4" />
                Réglages
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={routes.notifications} />} className="gap-2">
                <Bell className="size-4" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setPwaGuideOpen(true)}>
                <Smartphone className="size-4" />
                Installer l'app
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Thème</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("light")}>
                <Sun className="size-4" />
                Clair
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("dark")}>
                <Moon className="size-4" />
                Sombre
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setTheme("system")}>
                <Monitor className="size-4" />
                Système
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={routes.login} />} className="gap-2">
              <LogOut className="size-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
