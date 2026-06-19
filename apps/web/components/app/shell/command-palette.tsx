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
import { getClients, getContentItems } from "@/lib/mocks"
import { contentStatusMeta } from "@/lib/mocks/labels"
import type { Client } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { clientAccountIssues, clientSwitchHref } from "./client-nav"
import { useShell } from "./shell-provider"

// Palette de commandes globale (⌘K / Ctrl+K) : bascule de client (sous-page
// conservée), recherche de contenus tous clients, navigation, actions rapides.

const NAV_ITEMS = [
  { label: "Tableau de bord", href: routes.dashboard, icon: LayoutDashboard },
  { label: "Agenda unifié", href: routes.agenda, icon: CalendarDays },
  { label: "Notifications", href: routes.notifications, icon: Bell },
  { label: "Réglages — comptes connectés", href: routes.settings, icon: Settings },
] as const

function HealthDot() {
  return (
    <span
      title="Un compte est à reconnecter"
      className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-popover"
    />
  )
}

export function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const { paletteOpen, setPaletteOpen, setCaptureOpen, recentClientIds } = useShell()

  // Récents en tête, ordre stable pour le reste.
  const clients = useMemo(() => {
    const all = getClients()
    const rank = (c: Client) => {
      const i = recentClientIds.indexOf(c.id)
      return i === -1 ? recentClientIds.length : i
    }
    return [...all].sort((a, b) => rank(a) - rank(b))
  }, [recentClientIds])

  const contents = useMemo(() => getContentItems(), [])
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])

  function run(action: () => void) {
    setPaletteOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Recherche et commandes"
      description="Rechercher un client, un contenu ou lancer une action"
      className="sm:max-w-lg"
    >
      <Command loop>
        <CommandInput placeholder="Rechercher un client, un contenu, une action…" />
        <CommandList className="max-h-80">
          <CommandEmpty>Aucun résultat. Essaie un autre terme.</CommandEmpty>

          <CommandGroup heading="Clients">
            {clients.map((c) => {
              const issues = clientAccountIssues(c.id)
              return (
                <CommandItem
                  key={c.id}
                  value={`${c.name} @${c.handle} ${c.id}`}
                  onSelect={() => run(() => router.push(clientSwitchHref(pathname, c.id)))}
                >
                  <span className="relative inline-flex">
                    <ClientAvatar client={c} size={20} />
                    {issues.length > 0 ? <HealthDot /> : null}
                  </span>
                  <span className="truncate">{c.name}</span>
                  <CommandShortcut className="truncate tracking-normal">
                    {recentClientIds.includes(c.id) ? "Récent" : `@${c.handle}`}
                  </CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Actions rapides">
            <CommandItem
              value="noter une idée capture rapide"
              onSelect={() => run(() => setCaptureOpen(true))}
            >
              <Lightbulb />
              <span>Noter une idée</span>
            </CommandItem>
            {clients.map((c) => (
              <CommandItem
                key={`new-${c.id}`}
                value={`nouveau contenu pour ${c.name} ${c.id}`}
                onSelect={() => run(() => router.push(routes.contentNew(c.id)))}
              >
                <Plus />
                <span className="truncate">
                  Nouveau contenu pour <span className="font-medium">{c.name}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`aller à ${item.label}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Contenus — tous les clients">
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
                  {clientNames.get(item.clientId) ?? "—"} · {contentStatusMeta[item.status].label}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
