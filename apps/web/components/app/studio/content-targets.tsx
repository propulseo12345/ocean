"use client"

import { ExternalLink, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AccountAlert } from "@/components/shared/account-alert"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { QuotaGauge } from "@/components/shared/quota-gauge"
import { TargetStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatFollowers } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import type {
  Client,
  ContentTarget,
  QuotaUsage,
  SocialAccount,
  TargetStatus,
} from "@/lib/mocks/types"
import { DetailTargetError } from "./detail-target-error"

// Cibles d'un contenu reliées aux comptes réels : @username, abonnés, santé
// du compte (alerte reconnexion), quota restant, erreur + relance par cible.
// Relance/ignore = état local (aperçu). Idempotence : jamais de re-publication
// d'une cible déjà publiée.

const UPCOMING: TargetStatus[] = ["pending", "queued", "publishing"]

export function ContentTargets({
  targets,
  client,
  accounts,
  quotas,
  contentError,
  editHref,
}: {
  targets: ContentTarget[]
  client: Client
  accounts: SocialAccount[]
  quotas: Record<string, QuotaUsage | null>
  contentError?: string
  editHref: string
}) {
  const [overrides, setOverrides] = useState<Record<string, TargetStatus>>({})

  const statusOf = (t: ContentTarget): TargetStatus => overrides[t.id] ?? t.status
  const showIdempotence = targets.some((t) => statusOf(t) === "failed")

  function retry(target: ContentTarget) {
    setOverrides((prev) => ({ ...prev, [target.id]: "queued" }))
    toast.success("Cible relancée", {
      description:
        "Replacée en file (aperçu) — seule cette cible sera republiée, jamais celles déjà publiées.",
    })
  }

  function skip(target: ContentTarget) {
    setOverrides((prev) => ({ ...prev, [target.id]: "skipped" }))
    toast("Cible ignorée", {
      description: "Marquée « Ignoré » (aperçu) — le contenu reste publié sur les autres cibles.",
    })
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-xl border">
        {targets.map((target) => {
          const status = statusOf(target)
          const account = accounts.find((a) => a.id === target.socialAccountId) ?? null
          const upcoming = UPCOMING.includes(status)
          const usage = upcoming && account ? quotas[account.id] : null
          const unhealthy = account !== null && account.status !== "connected"

          return (
            <li key={target.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <PlatformIcon platform={target.platform} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{platformMeta[target.platform].label}</span>
                    {target.captionOverride ? (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                        Légende déclinée
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account
                      ? `@${account.username} · ${formatFollowers(account.followers)} abonnés`
                      : "Canal manuel — publication assistée"}
                  </p>
                  {target.publishedAt ? (
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      Publié le {formatDateTime(target.publishedAt, client.timezone)}
                    </p>
                  ) : null}
                </div>
                {account && unhealthy ? <AccountAlert account={account} variant="inline" /> : null}
                <TargetStatusBadge status={status} />
                {target.permalink ? (
                  <Button
                    variant="outline"
                    size="xs"
                    render={<a href={target.permalink} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink />
                    Voir
                  </Button>
                ) : null}
              </div>

              {unhealthy && upcoming ? (
                <p className="text-[11px] font-medium text-warning">
                  La publication échouera tant que le compte n'est pas reconnecté.
                </p>
              ) : null}

              {usage ? <QuotaGauge usage={usage} className="max-w-56" /> : null}

              {status === "failed" ? (
                <DetailTargetError
                  message={contentError}
                  editHref={editHref}
                  onRetry={() => retry(target)}
                  onSkip={() => skip(target)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>

      {showIdempotence ? (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          Règle d'idempotence : une cible déjà publiée n'est jamais republiée — la relance ne
          concerne que les cibles en échec.
        </p>
      ) : null}
    </div>
  )
}
