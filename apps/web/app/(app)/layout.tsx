import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { NotificationsButton } from "@/components/app/notifications-button"
import { CommandPalette } from "@/components/app/shell/command-palette"
import { DemoBanner } from "@/components/app/shell/demo-banner"
import { HeaderSearchButton } from "@/components/app/shell/header-search-button"
import { PwaInstallAssistant } from "@/components/app/shell/pwa-install-assistant"
import { QuickCapture } from "@/components/app/shell/quick-capture"
import { ShellProvider } from "@/components/app/shell/shell-provider"
import { ShortcutsDialog } from "@/components/app/shell/shortcuts-dialog"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DemoBanner />
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
            <div className="ml-auto flex items-center gap-1">
              <HeaderSearchButton />
              <NotificationsButton />
              <ThemeToggle />
            </div>
          </header>
          <PwaInstallAssistant />
          <main id="contenu" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6">
            {children}
          </main>
        </SidebarInset>
        <CommandPalette />
        <QuickCapture />
        <ShortcutsDialog />
      </SidebarProvider>
    </ShellProvider>
  )
}
