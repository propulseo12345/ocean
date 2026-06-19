"use client"

import { AtSign, Clock, Pencil } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { initials } from "@/lib/format"
import { approvalModeMeta, platformMeta } from "@/lib/mocks/labels"
import { cn } from "@/lib/utils"
import {
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
  children,
}: {
  title: string
  step: WizardStepId
  onEdit: (step: WizardStepId) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="xs" onClick={() => onEdit(step)}>
          <Pencil />
          Modifier
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
  const connected = draft.accounts.filter((a) => a.connected)
  const total = pillarShareTotal(draft.pillars)
  const emailTouched = draft.reviewerEmail.trim().length > 0
  const emailInvalid = emailTouched && !isValidEmail(draft.reviewerEmail)

  return (
    <div className="space-y-4">
      <SummaryCard title="Identité" step="identity" onEdit={onEdit}>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-semibold text-white"
            style={{ backgroundColor: draft.brandColor }}
            aria-hidden
          >
            {initials(draft.name || "?")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{draft.name || "—"}</p>
            <p className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-0.5">
                <AtSign className="size-3" />
                {draft.handle || "—"}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Clock className="size-3" />
                {draft.timezone}
              </span>
            </p>
          </div>
        </div>
        {draft.category ? <p className="mt-2 text-xs">{draft.category}</p> : null}
      </SummaryCard>

      <SummaryCard title="Comptes sociaux" step="accounts" onEdit={onEdit}>
        {connected.length === 0 ? (
          <p className="text-xs">Aucun compte connecté — à faire plus tard dans les réglages.</p>
        ) : (
          <ul className="space-y-1">
            {connected.map((a) => (
              <li key={a.platform} className="flex items-center gap-2 text-sm">
                <PlatformIcon platform={a.platform} className="size-3.5" />
                {platformMeta[a.platform].label}
                <span className="text-xs text-muted-foreground">@{a.username}</span>
              </li>
            ))}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard title="Marque" step="brand" onEdit={onEdit}>
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
            Ton : <span className="text-foreground">{draft.tone || "non défini"}</span> ·{" "}
            {draft.doList.length} à faire · {draft.dontList.length} à éviter ·{" "}
            {draft.bannedWords.length} mot{draft.bannedWords.length > 1 ? "s" : ""} interdit
            {draft.bannedWords.length > 1 ? "s" : ""}
          </p>
        </div>
      </SummaryCard>

      <SummaryCard title="Stratégie" step="strategy" onEdit={onEdit}>
        <div className="space-y-1.5 text-xs">
          {draft.pillars.length > 0 ? (
            <p>
              <span className="text-foreground">{draft.pillars.length} piliers</span> ·{" "}
              <span className={cn(total === 100 ? "text-success" : undefined)}>mix {total} %</span>
            </p>
          ) : (
            <p>Aucun pilier défini.</p>
          )}
          <p>
            <span className="text-foreground">{draft.slots.length}</span> créneau
            {draft.slots.length > 1 ? "x" : ""} récurrent{draft.slots.length > 1 ? "s" : ""}
            {draft.slots.length > 0
              ? ` (${draft.slots
                  .map((s) => WEEKDAYS.find((d) => d.value === s.weekday)?.short)
                  .join(", ")})`
              : ""}
          </p>
          <p>
            Validation :{" "}
            <span className="text-foreground">{approvalModeMeta[draft.approvalMode].label}</span>
          </p>
        </div>
      </SummaryCard>

      <div className="space-y-1.5 rounded-xl border border-dashed p-4">
        <Label htmlFor="reviewer-email">Inviter un valideur (optionnel)</Label>
        <p className="text-xs text-muted-foreground">
          Le contact du client qui validera les publications depuis le portail. Un email de
          bienvenue partira via Brevo — aucun envoi pendant l'aperçu.
        </p>
        <Input
          id="reviewer-email"
          type="email"
          value={draft.reviewerEmail}
          onChange={(e) => patch({ reviewerEmail: e.target.value })}
          placeholder="contact@client.fr"
          aria-invalid={emailInvalid}
          autoComplete="off"
        />
        {emailInvalid ? <p className="text-xs text-destructive">Adresse email invalide.</p> : null}
      </div>
    </div>
  )
}
