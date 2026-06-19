"use client"

import { AtSign, Clock, Pencil } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { initials } from "@/lib/format"
import { type Translator, useLabels, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  CATEGORIES,
  type ClientDraft,
  isValidEmail,
  pillarShareTotal,
  WEEKDAYS,
  type WizardStepId,
} from "./wizard-types"

// Étape 5 — récapitulatif : synthèse de tout le draft, éditable via retour à
// l'étape concernée, invitation reviewer optionnelle (email mock).

function SummaryCard({
  title,
  step,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  step: WizardStepId
  onEdit: (step: WizardStepId) => void
  editLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="xs" onClick={() => onEdit(step)}>
          <Pencil />
          {editLabel}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function StepReview({
  draft,
  patch,
  onEdit,
}: {
  draft: ClientDraft
  patch: (partial: Partial<ClientDraft>) => void
  onEdit: (step: WizardStepId) => void
}) {
  const t = useT()
  const lbl = useLabels()
  const editLabel = t("common.edit")
  const empty = t("onboarding.review.emptyValue")
  const connected = draft.accounts.filter((a) => a.connected)
  const total = pillarShareTotal(draft.pillars)
  const emailTouched = draft.reviewerEmail.trim().length > 0
  const emailInvalid = emailTouched && !isValidEmail(draft.reviewerEmail)
  const categoryLabelKey = CATEGORIES.find((c) => c.value === draft.category)?.labelKey
  // Le ton est stocké comme clé i18n (cf. TONES) : on le résout pour l'affichage.
  const toneLabel = draft.tone
    ? t(draft.tone as Parameters<Translator>[0])
    : t("onboarding.review.toneUndefined")
  const slotDays = draft.slots
    .map((s) => {
      const key = WEEKDAYS.find((d) => d.value === s.weekday)?.shortKey
      return key ? t(key) : ""
    })
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-4">
      <SummaryCard
        title={t("onboarding.review.cardIdentity")}
        step="identity"
        onEdit={onEdit}
        editLabel={editLabel}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-semibold text-white"
            style={{ backgroundColor: draft.brandColor }}
            aria-hidden
          >
            {initials(draft.name || "?")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{draft.name || empty}</p>
            <p className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-0.5">
                <AtSign className="size-3" />
                {draft.handle || empty}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Clock className="size-3" />
                {draft.timezone}
              </span>
            </p>
          </div>
        </div>
        {categoryLabelKey ? <p className="mt-2 text-xs">{t(categoryLabelKey)}</p> : null}
      </SummaryCard>

      <SummaryCard
        title={t("onboarding.review.cardAccounts")}
        step="accounts"
        onEdit={onEdit}
        editLabel={editLabel}
      >
        {connected.length === 0 ? (
          <p className="text-xs">{t("onboarding.review.noAccounts")}</p>
        ) : (
          <ul className="space-y-1">
            {connected.map((a) => (
              <li key={a.platform} className="flex items-center gap-2 text-sm">
                <PlatformIcon platform={a.platform} className="size-3.5" />
                {lbl.platform(a.platform)}
                <span className="text-xs text-muted-foreground">@{a.username}</span>
              </li>
            ))}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard
        title={t("onboarding.review.cardBrand")}
        step="brand"
        onEdit={onEdit}
        editLabel={editLabel}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {draft.palette.map((c) => (
              <span
                key={c}
                className="size-5 rounded-md"
                style={{ backgroundColor: c }}
                aria-hidden
              />
            ))}
          </div>
          <p className="text-xs">
            {t("onboarding.review.toneLine")} <span className="text-foreground">{toneLabel}</span> ·{" "}
            {t("onboarding.review.doCount", { count: draft.doList.length })} ·{" "}
            {t("onboarding.review.dontCount", { count: draft.dontList.length })} ·{" "}
            {t("onboarding.review.bannedCount", { count: draft.bannedWords.length })}
          </p>
        </div>
      </SummaryCard>

      <SummaryCard
        title={t("onboarding.review.cardStrategy")}
        step="strategy"
        onEdit={onEdit}
        editLabel={editLabel}
      >
        <div className="space-y-1.5 text-xs">
          {draft.pillars.length > 0 ? (
            <p>
              <span className="text-foreground">
                {t("onboarding.review.pillarsLine", { count: draft.pillars.length })}
              </span>{" "}
              ·{" "}
              <span className={cn(total === 100 ? "text-success" : undefined)}>
                {t("onboarding.review.mixLine", { total })}
              </span>
            </p>
          ) : (
            <p>{t("onboarding.review.noPillars")}</p>
          )}
          <p>
            <span className="text-foreground">
              {t("onboarding.review.slotsLine", { count: draft.slots.length })}
            </span>
            {slotDays ? ` (${slotDays})` : ""}
          </p>
          <p>
            {t("onboarding.review.approvalLine")}{" "}
            <span className="text-foreground">{lbl.approvalMode(draft.approvalMode)}</span>
          </p>
        </div>
      </SummaryCard>

      <div className="space-y-1.5 rounded-xl border border-dashed p-4">
        <Label htmlFor="reviewer-email">{t("onboarding.review.reviewerLabel")}</Label>
        <p className="text-xs text-muted-foreground">{t("onboarding.review.reviewerHint")}</p>
        <Input
          id="reviewer-email"
          type="email"
          value={draft.reviewerEmail}
          onChange={(e) => patch({ reviewerEmail: e.target.value })}
          placeholder={t("onboarding.review.reviewerPlaceholder")}
          aria-invalid={emailInvalid}
          autoComplete="off"
        />
        {emailInvalid ? (
          <p className="text-xs text-destructive">{t("onboarding.review.reviewerInvalid")}</p>
        ) : null}
      </div>
    </div>
  )
}
