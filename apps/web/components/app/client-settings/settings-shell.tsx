"use client"

import {
  Archive,
  CalendarClock,
  type LucideIcon,
  Palette,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Waypoints,
} from "lucide-react"
import { useState } from "react"
import type { ClientSettings } from "@/lib/data"
import { type MessageKey, useT } from "@/lib/i18n"
import type {
  BrandKit,
  Client,
  ContentItem,
  ContentPillar,
  RecurringSlot,
  Reviewer,
  SocialAccount,
} from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { SectionAccounts } from "./section-accounts"
import { SectionApproval } from "./section-approval"
import { SectionBrandKit } from "./section-brand-kit"
import { SectionCadence } from "./section-cadence"
import { SectionDanger } from "./section-danger"
import { SectionProfile } from "./section-profile"
import { SectionSlots } from "./section-slots"

interface NavItem {
  id: string
  labelKey: MessageKey
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { id: "profil", labelKey: "clientSettings.nav.profile", icon: UserRound },
  { id: "comptes", labelKey: "clientSettings.nav.accounts", icon: Waypoints },
  { id: "marque", labelKey: "clientSettings.nav.brand", icon: Palette },
  { id: "validation", labelKey: "clientSettings.nav.approval", icon: ShieldCheck },
  { id: "creneaux", labelKey: "clientSettings.nav.slots", icon: CalendarClock },
  { id: "cadence", labelKey: "clientSettings.nav.cadence", icon: TriangleAlert },
  { id: "archivage", labelKey: "clientSettings.nav.archive", icon: Archive },
]

export function SettingsShell({
  client,
  accounts,
  brandKit,
  reviewer,
  slots,
  pillars,
  trashed,
  settings,
}: {
  client: Client
  accounts: SocialAccount[]
  brandKit: BrandKit | undefined
  reviewer: Reviewer | undefined
  slots: RecurringSlot[]
  pillars: ContentPillar[]
  trashed: ContentItem[]
  settings: ClientSettings
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <SectionNav />
      <div className="min-w-0 flex-1 space-y-8">
        <Anchor id="profil">
          <SectionProfile client={client} />
        </Anchor>
        <Anchor id="comptes">
          <SectionAccounts accounts={accounts} />
        </Anchor>
        <Anchor id="marque">
          <SectionBrandKit clientId={client.id} brandKit={brandKit} />
        </Anchor>
        <Anchor id="validation">
          <SectionApproval
            client={client}
            reviewer={reviewer}
            reminderDays={settings.reviewReminderDays}
          />
        </Anchor>
        <Anchor id="creneaux">
          <SectionSlots client={client} slots={slots} pillars={pillars} />
        </Anchor>
        <Anchor id="cadence">
          <SectionCadence clientId={client.id} settings={settings} />
        </Anchor>
        <Anchor id="archivage">
          <SectionDanger client={client} trashed={trashed} />
        </Anchor>
      </div>
    </div>
  )
}

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  // scroll-mt compense l'en-tête collant lors d'un saut d'ancre.
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  )
}

function SectionNav() {
  const t = useT()
  const [active, setActive] = useState(NAV[0].id)

  return (
    <nav
      aria-label={t("clientSettings.nav.ariaLabel")}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:w-44 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {NAV.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={() => setActive(item.id)}
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:py-1.5",
            active === item.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <item.icon className="size-4 shrink-0" />
          {t(item.labelKey)}
        </a>
      ))}
    </nav>
  )
}
