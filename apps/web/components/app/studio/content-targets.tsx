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
import { requestTargetRetry } from "@/lib/actions/content-status"
import type { Client, ContentTarget, QuotaUsage, SocialAccount, TargetStatus } from "@/lib/domain"
import { useFormat, useLabels, useT } from "@/lib/i18n"
import { DetailTargetError } from "./detail-target-error"

// Cibles d'un contenu reliées aux comptes réels : @username, abonnés, santé
// du compte (alerte reconnexion), quota restant, erreur + relance par cible.
// Relance/ignore = état local (aperçu). Idempotence : jamais de re-publication
// d'une cible déjà publiée.

const UPCOMING: TargetStatus[] = ["pending", "queued", "publishing"]

export function ContentTargets({
  targets,
  client,
  clientId,
  contentId,
  accounts,
  quotas,
  contentError,
  editHref,
}: {
  targets: ContentTarget[]
  client: Client
  clientId: string
  contentId: string
  accounts: SocialAccount[]
  quotas: Record<string, QuotaUsage | null>
  contentError?: string
  editHref: string
}) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const [overrides, setOverrides] = useState<Record<string, TargetStatus>>({})

  const statusOf = (tg: ContentTarget): TargetStatus => overrides[tg.id] ?? tg.status
  const showIdempotence = targets.some((tg) => statusOf(tg) === "failed")

  // RÈGLE 15 : on POSE une intention (retry_requested_at), on ne remet PAS la
  // cible en file — le worker seul republie (et interroge le container si
  // publish_started_at est non nul). L'override "queued" est un indice optimiste
  // de ce que le worker fera ; rollback si l'écriture de l'intention échoue.
  async function retry(target: ContentTarget) {
    setOverrides((prev) => ({ ...prev, [target.id]: "queued" }))
    const res = await requestTargetRetry({ clientId, contentId, targetId: target.id })
    if (!res.ok) {
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[target.id]
        return next
      })
      toast.error(t("studio.targets.retryError"))
      return
    }
    toast.success(t("studio.targets.retried"), {
      description: t("studio.targets.retriedDesc"),
    })
  }

  function skip(target: ContentTarget) {
    setOverrides((prev) => ({ ...prev, [target.id]: "skipped" }))
    toast(t("studio.targets.skipped"), {
      description: t("studio.targets.skippedDesc"),
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
                    <span className="truncate">{lbl.platform(target.platform)}</span>
                    {target.captionOverride ? (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                        {t("studio.targets.captionOverride")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account
                      ? t("studio.targets.followers", {
                          username: account.username,
                          count: f.followers(account.followers),
                        })
                      : t("studio.targets.manualChannel")}
                  </p>
                  {target.publishedAt ? (
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {t("studio.targets.publishedOn", {
                        date: f.dateTime(target.publishedAt, client.timezone),
                      })}
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
                    {t("studio.targets.view")}
                  </Button>
                ) : null}
              </div>

              {unhealthy && upcoming ? (
                <p className="text-[11px] font-medium text-warning">
                  {t("studio.targets.unhealthyWarning")}
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
          {t("studio.targets.idempotence")}
        </p>
      ) : null}
    </div>
  )
}
