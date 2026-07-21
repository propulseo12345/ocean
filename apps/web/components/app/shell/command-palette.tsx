"use client"

import { Bell, CalendarDays, LayoutDashboard, Lightbulb, Plus, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useMemo } from "react"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { StatusDot } from "@/components/shared/status-dot"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import type { Client, ContentItem, SocialAccount } from "@/lib/domain"
import { useLabels, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { clientAccountIssues, clientSwitchHref } from "./client-nav"
import { useShell } from "./shell-provider"

// Palette de commandes globale (⌘K / Ctrl+K) : bascule de client (sous-page
// conservée), recherche de contenus tous clients, navigation, actions rapides.

const NAV_ITEMS = [
  { labelKey: "nav.item.dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { labelKey: "nav.item.agenda", href: routes.agenda, icon: CalendarDays },
  { labelKey: "nav.item.notifications", href: routes.notifications, icon: Bell },
  { labelKey: "nav.item.settingsAccounts", href: routes.settings, icon: Settings },
] as const

function HealthDot({ label }: { label: string }) {
  return (
    <span
      title={label}
      className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-popover"
    />
  )
}

export function CommandPalette({
  clients: allClients,
  contentItems,
  socialAccounts,
}: {
  clients: Client[]
  contentItems: ContentItem[]
  socialAccounts: SocialAccount[]
}) {
  const t = useT()
  const lbl = useLabels()
  const router = useRouter()
  const pathname = usePathname()
  const { paletteOpen, setPaletteOpen, setCaptureOpen, recentClientIds } = useShell()

  // Récents en tête, ordre stable pour le reste.
  const clients = useMemo(() => {
    const rank = (c: Client) => {
      const i = recentClientIds.indexOf(c.id)
      return i === -1 ? recentClientIds.length : i
    }
    return [...allClients].sort((a, b) => rank(a) - rank(b))
  }, [allClients, recentClientIds])

  const contents = contentItems
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])

  function run(action: () => void) {
    setPaletteOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title={t("nav.palette.title")}
      description={t("nav.palette.description")}
      className="sm:max-w-lg"
    >
      <Command loop>
        <CommandInput placeholder={t("nav.palette.inputPlaceholder")} />
        <CommandList className="max-h-80">
          <CommandEmpty>{t("nav.palette.empty")}</CommandEmpty>

          <CommandGroup heading={t("nav.palette.groupClients")}>
            {clients.map((c) => {
              const issues = clientAccountIssues(socialAccounts, c.id)
              return (
                <CommandItem
                  key={c.id}
                  value={`${c.name} @${c.handle} ${c.id}`}
                  onSelect={() => run(() => router.push(clientSwitchHref(pathname, c.id)))}
                >
                  <span className="relative inline-flex">
                    <ClientAvatar client={c} size={20} />
                    {issues.length > 0 ? <HealthDot label={t("nav.accountReconnect")} /> : null}
                  </span>
                  <span className="truncate">{c.name}</span>
                  <CommandShortcut className="truncate tracking-normal">
                    {recentClientIds.includes(c.id) ? t("nav.palette.recent") : `@${c.handle}`}
                  </CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading={t("nav.palette.groupQuickActions")}>
            <CommandItem
              value="noter une idée capture rapide jot down idea quick capture"
              onSelect={() => run(() => setCaptureOpen(true))}
            >
              <Lightbulb />
              <span>{t("nav.palette.noteIdea")}</span>
            </CommandItem>
            {clients.map((c) => (
              <CommandItem
                key={`new-${c.id}`}
                value={`${t("nav.palette.newContentFor")} ${c.name} ${c.id}`}
                onSelect={() => run(() => router.push(routes.contentNew(c.id)))}
              >
                <Plus />
                <span className="truncate">
                  {t("nav.palette.newContentFor")} <span className="font-medium">{c.name}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading={t("nav.palette.groupNavigation")}>
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={t(item.labelKey)}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                <span>{t(item.labelKey)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading={t("nav.palette.groupContents")}>
            {contents.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${clientNames.get(item.clientId) ?? ""} ${item.id}`}
                keywords={[item.caption]}
                onSelect={() => run(() => router.push(routes.content(item.clientId, item.id)))}
              >
                <StatusDot status={item.status} withTooltip={false} />
                <span className="truncate">{item.title}</span>
                <CommandShortcut className="shrink-0 tracking-normal">
                  {clientNames.get(item.clientId) ?? "—"} · {lbl.contentStatus(item.status)}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
