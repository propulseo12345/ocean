"use client"

import { CalendarOff, ClockAlert } from "lucide-react"
import { AccountAlert } from "@/components/shared/account-alert"
import { Button } from "@/components/ui/button"
import { platformMeta } from "@/lib/mocks/labels"
import type { SocialAccount } from "@/lib/mocks/types"

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
                ? `${upcoming} publication${upcoming > 1 ? "s" : ""} ${platformMeta[account.platform].label} risque${upcoming > 1 ? "nt" : ""} d'échouer — reconnecte le compte @${account.username}.`
                : undefined
            }
          />
        )
      })}

      {pendingReviewCount > 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2">
          <ClockAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            {pendingReviewCount} contenu{pendingReviewCount > 1 ? "s" : ""} en attente de validation
            client.
          </p>
          <Button size="sm" variant="outline" onClick={onFilterPendingReview}>
            Voir
          </Button>
        </div>
      ) : null}

      {nextWeekEmpty ? (
        <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
          <CalendarOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Rien n'est programmé sur les 7 prochains jours pour ce client.
          </p>
        </div>
      ) : null}
    </div>
  )
}
