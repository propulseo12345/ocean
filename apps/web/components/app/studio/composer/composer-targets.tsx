"use client"

import { Mail, Megaphone } from "lucide-react"
import { AccountAlert } from "@/components/shared/account-alert"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { QuotaGauge } from "@/components/shared/quota-gauge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatFollowers } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import type { Platform, QuotaUsage, SocialAccount } from "@/lib/mocks/types"
import type { ComposerDraft } from "./composer-types"

// Section « Diffusion » : ciblage par compte social connecté (statut + quota)
// et canaux manuels (newsletter avec objet, sur-mesure).

export function ComposerTargets({
  draft,
  accounts,
  quotas,
  onPatch,
}: {
  draft: ComposerDraft
  accounts: SocialAccount[]
  quotas: Record<string, QuotaUsage | null>
  onPatch: (partial: Partial<ComposerDraft>) => void
}) {
  function toggleAccount(id: string, checked: boolean) {
    onPatch({
      accountIds: checked ? [...draft.accountIds, id] : draft.accountIds.filter((a) => a !== id),
    })
  }

  function toggleManual(platform: Platform, checked: boolean) {
    onPatch({
      manualPlatforms: checked
        ? [...draft.manualPlatforms, platform]
        : draft.manualPlatforms.filter((p) => p !== platform),
    })
  }

  const newsletterOn = draft.manualPlatforms.includes("newsletter")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diffusion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-xl border">
          {accounts.map((account) => {
            const checked = draft.accountIds.includes(account.id)
            const quota = quotas[account.id]
            return (
              <li key={account.id} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <PlatformIcon platform={account.platform} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                      <span className="truncate">{platformMeta[account.platform].label}</span>
                      <AccountAlert account={account} variant="inline" />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{account.username} · {formatFollowers(account.followers)} abonnés
                    </p>
                  </div>
                  {quota && checked ? (
                    <QuotaGauge usage={quota} className="hidden w-36 sm:block" />
                  ) : null}
                  <Switch
                    checked={checked}
                    onCheckedChange={(next) => toggleAccount(account.id, next)}
                    aria-label={`Cibler ${platformMeta[account.platform].label} @${account.username}`}
                  />
                </div>
                {quota && checked ? <QuotaGauge usage={quota} className="sm:hidden" /> : null}
              </li>
            )
          })}
        </ul>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Canaux manuels</p>
          <ul className="divide-y rounded-xl border">
            <li className="space-y-2.5 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Mail className="size-4" style={{ color: platformMeta.newsletter.colorVar }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Newsletter</p>
                  <p className="text-xs text-muted-foreground">
                    Publication manuelle assistée à l'heure programmée.
                  </p>
                </div>
                <Switch
                  checked={newsletterOn}
                  onCheckedChange={(next) => toggleManual("newsletter", next)}
                  aria-label="Cibler la newsletter"
                />
              </div>
              {newsletterOn ? (
                <div className="space-y-1.5 pl-11">
                  <Label htmlFor="composer-nl-subject" className="text-xs">
                    Objet de la newsletter
                  </Label>
                  <Input
                    id="composer-nl-subject"
                    value={draft.newsletterSubject}
                    onChange={(e) => onPatch({ newsletterSubject: e.target.value })}
                    placeholder="Ex. : Le cold brew arrive en bouteille ☀️"
                  />
                </div>
              ) : null}
            </li>
            <li className="flex items-center gap-3 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Megaphone className="size-4" style={{ color: platformMeta.custom.colorVar }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Sur mesure</p>
                <p className="text-xs text-muted-foreground">
                  Canal libre (affichage, print, story avec stickers…) — checklist manuelle.
                </p>
              </div>
              <Switch
                checked={draft.manualPlatforms.includes("custom")}
                onCheckedChange={(next) => toggleManual("custom", next)}
                aria-label="Cibler le canal sur mesure"
              />
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
