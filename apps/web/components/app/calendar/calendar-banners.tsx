"use client"

import { CalendarOff, ClockAlert } from "lucide-react"
import { AccountAlert } from "@/components/shared/account-alert"
import { Button } from "@/components/ui/button"
import type { SocialAccount } from "@/lib/domain"
import { useLabels, useT } from "@/lib/i18n"

// Bandeaux d'alerte du calendrier : comptes à reconnecter (avec impact),
// contenus en attente de validation, semaine à venir vide.

export function CalendarBanners({
  accounts,
  upcomingByAccount,
  pendingReviewCount,
  nextWeekEmpty,
  onFilterPendingReview,
}: {
  accounts: SocialAccount[]
  /** Nombre de publications à venir par compte en défaut. */
  upcomingByAccount: ReadonlyMap<string, number>
  pendingReviewCount: number
  nextWeekEmpty: boolean
  onFilterPendingReview: () => void
}) {
  const t = useT()
  const lbl = useLabels()
  const broken = accounts.filter((a) => a.status !== "connected")

  return (
    <div className="space-y-2 empty:hidden">
      {broken.map((account) => {
        const upcoming = upcomingByAccount.get(account.id) ?? 0
        return (
          <AccountAlert
            key={account.id}
            account={account}
            impact={
              upcoming > 0
                ? t("calendar.banners.reconnectImpact", {
                    count: upcoming,
                    platform: lbl.platform(account.platform),
                    username: account.username,
                  })
                : undefined
            }
          />
        )
      })}

      {pendingReviewCount > 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2">
          <ClockAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            {t("calendar.banners.pendingReview", { count: pendingReviewCount })}
          </p>
          <Button size="sm" variant="outline" onClick={onFilterPendingReview}>
            {t("calendar.banners.pendingReviewAction")}
          </Button>
        </div>
      ) : null}

      {nextWeekEmpty ? (
        <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
          <CalendarOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t("calendar.banners.nextWeekEmpty")}
          </p>
        </div>
      ) : null}
    </div>
  )
}
