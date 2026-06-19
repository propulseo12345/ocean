import { initials } from "@/lib/format"
import type { Client } from "@/lib/mocks/types"
import { compactNumber } from "./perf-utils"

// En-tête brandé du rapport : initiales du client sur sa couleur de marque,
// nom, handle, période et abonnés. La teinte vient des données (oklch).

export function ReportHeader({
  client,
  periodLabel,
  accentColor,
  igFollowers,
}: {
  client: Client
  periodLabel: string
  accentColor: string
  igFollowers: number
}) {
  return (
    <header
      className="flex items-center gap-4 rounded-xl border-l-4 bg-card p-5"
      style={{ borderLeftColor: accentColor }}
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-xl font-heading text-xl font-semibold text-white"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      >
        {initials(client.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bilan mensuel · {periodLabel}
        </p>
        <h1 className="truncate font-heading text-2xl font-semibold leading-tight">
          {client.name}
        </h1>
        <p className="text-sm text-muted-foreground">@{client.handle}</p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="font-heading text-xl font-semibold tabular-nums">
          {compactNumber(igFollowers)}
        </p>
        <p className="text-xs text-muted-foreground">abonnés Instagram</p>
      </div>
    </header>
  )
}
