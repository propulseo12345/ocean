"use client"

import { PlatformIcon } from "@/components/shared/platform-badge"
import { QuotaGauge } from "@/components/shared/quota-gauge"
import { useT } from "@/lib/i18n"
import type { QuotaRow } from "./board-types"

// Jauges de quotas plateformes en tête de board — affichage ergonomique
// uniquement : l'enforcement réel vivra côté worker/DB (CLAUDE.md §6).

export function BoardQuotas({ rows }: { rows: QuotaRow[] }) {
  const t = useT()
  if (rows.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card/40 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{t("studio.quotas.title")}</span>
      {rows.map(({ account, usage }) => (
        <div
          key={account.id}
          className="flex min-w-36 flex-1 items-center gap-2 sm:flex-none"
          title={t("studio.quotas.tooltip")}
        >
          <PlatformIcon platform={account.platform} className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-muted-foreground">@{account.username}</p>
            <QuotaGauge usage={usage} className="w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}
