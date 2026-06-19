"use client"

import {
  CalendarDays,
  ChartColumn,
  FolderOpen,
  LayoutGrid,
  Settings2,
  SquarePen,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"

export function ClientTabs({ clientId }: { clientId: string }) {
  const t = useT()
  const pathname = usePathname()
  const tabs = [
    { label: t("nav.tab.grid"), href: routes.clientGrid(clientId), icon: LayoutGrid },
    { label: t("nav.tab.calendar"), href: routes.clientCalendar(clientId), icon: CalendarDays },
    { label: t("nav.tab.studio"), href: routes.clientContent(clientId), icon: SquarePen },
    { label: t("nav.tab.library"), href: routes.clientLibrary(clientId), icon: FolderOpen },
    {
      label: t("nav.tab.performance"),
      href: routes.clientPerformance(clientId),
      icon: ChartColumn,
    },
    { label: t("nav.tab.settings"), href: routes.clientSettings(clientId), icon: Settings2 },
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
