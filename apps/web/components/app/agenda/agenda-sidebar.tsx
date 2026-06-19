"use client"

import { CalendarRange, Send } from "lucide-react"
import { GoogleIcon, MicrosoftIcon } from "@/components/app/agenda/provider-icons"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Switch } from "@/components/ui/switch"
import type { CalendarAccount, CalendarProvider } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export interface CalendarFilter {
  name: string
  colorVar: string
  accountId: string
}

function ProviderIcon({ provider }: { provider: CalendarProvider }) {
  return provider === "google" ? (
    <GoogleIcon className="size-4" />
  ) : (
    <MicrosoftIcon className="size-4" />
  )
}

export function AgendaSidebar({
  accounts,
  calendars,
  disabled,
  onToggle,
}: {
  accounts: CalendarAccount[]
  calendars: CalendarFilter[]
  disabled: ReadonlySet<string>
  onToggle: (name: string) => void
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold">Comptes connectés</h2>
        <ul className="space-y-2">
          {accounts.map((acc) => (
            <li key={acc.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <ProviderIcon provider={acc.provider} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{acc.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{acc.email}</span>
              </span>
              <AccountStatusBadge status={acc.status} className="shrink-0" />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold">Calendriers</h2>
        <ul className="space-y-1">
          {calendars.map((cal) => {
            const enabled = !disabled.has(cal.name)
            return (
              <li key={cal.name}>
                <div className="-mx-1 flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/50">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full transition-opacity",
                      enabled ? "opacity-100" : "opacity-30"
                    )}
                    style={{ backgroundColor: cal.colorVar }}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm transition-colors",
                      enabled ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {cal.name}
                  </span>
                  <Switch
                    size="sm"
                    checked={enabled}
                    onCheckedChange={() => onToggle(cal.name)}
                    aria-label={`Afficher le calendrier ${cal.name}`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="font-heading text-sm font-semibold">Légende</h2>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border-l-2 border-l-foreground/40 bg-card">
            <CalendarRange className="size-3.5" />
          </span>
          Rendez-vous agenda
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed bg-primary/10 text-primary">
            <Send className="size-3.5" />
          </span>
          Publication planifiée
        </div>
      </section>
    </div>
  )
}
