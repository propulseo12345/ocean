"use client"

import { CalendarDays, Share2, UserRound } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CalendarAccount, User } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { AccountsTab, type ClientAccountsGroup } from "./accounts-tab"
import { CalendarsTab } from "./calendars-tab"
import { ProfileTab } from "./profile-tab"

export function SettingsTabs({
  groups,
  needsAttentionCount,
  calendars,
  user,
}: {
  groups: ClientAccountsGroup[]
  needsAttentionCount: number
  calendars: CalendarAccount[]
  user: User
}) {
  const t = useT()
  return (
    <Tabs defaultValue="social" className="gap-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="social">
          <Share2 />
          {t("settings.tabs.social")}
        </TabsTrigger>
        <TabsTrigger value="calendars">
          <CalendarDays />
          {t("settings.tabs.calendars")}
        </TabsTrigger>
        <TabsTrigger value="profile">
          <UserRound />
          {t("settings.tabs.profile")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="social">
        <AccountsTab groups={groups} needsAttentionCount={needsAttentionCount} />
      </TabsContent>

      <TabsContent value="calendars">
        <CalendarsTab accounts={calendars} />
      </TabsContent>

      <TabsContent value="profile">
        <ProfileTab user={user} />
      </TabsContent>
    </Tabs>
  )
}
