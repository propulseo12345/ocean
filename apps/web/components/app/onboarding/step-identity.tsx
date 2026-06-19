"use client"

import { AtSign, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { BrandColorPalette } from "./brand-color-palette"
import { CATEGORIES, type ClientDraft, normalizeHandle, TIMEZONES } from "./wizard-types"

// Étape 1 — identité du client : nom, @handle, catégorie, bio, fuseau, teinte.
// Aperçu live d'une carte client à droite (carte = client-avatar + nom + handle).

export function StepIdentity({
  draft,
  patch,
  firstFieldRef,
}: {
  draft: ClientDraft
  patch: (partial: Partial<ClientDraft>) => void
  firstFieldRef: React.RefObject<HTMLInputElement | null>
}) {
  const t = useT()
  const previewInitials = initials(draft.name || t("onboarding.identity.newClient"))
  const categoryLabel = CATEGORIES.find((c) => c.value === draft.category)?.labelKey

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">
              {t("onboarding.identity.nameLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cl-name"
              ref={firstFieldRef}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t("onboarding.identity.namePlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-handle">
              {t("onboarding.identity.handleLabel")} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cl-handle"
                value={draft.handle}
                onChange={(e) => patch({ handle: normalizeHandle(e.target.value) })}
                placeholder={t("onboarding.identity.handlePlaceholder")}
                className="pl-7"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("onboarding.identity.handleHint")}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cl-category">{t("onboarding.identity.categoryLabel")}</Label>
            <Select value={draft.category} onValueChange={(v) => patch({ category: String(v) })}>
              <SelectTrigger id="cl-category" className="w-full">
                <SelectValue placeholder={t("onboarding.identity.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-tz">{t("onboarding.identity.timezoneLabel")}</Label>
            <Select value={draft.timezone} onValueChange={(v) => patch({ timezone: String(v) })}>
              <SelectTrigger id="cl-tz" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {t(tz.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("onboarding.identity.timezoneHint")}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cl-bio">{t("onboarding.identity.bioLabel")}</Label>
          <Textarea
            id="cl-bio"
            value={draft.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            placeholder={t("onboarding.identity.bioPlaceholder")}
            rows={3}
          />
        </div>

        <BrandColorPalette
          value={draft.brandColor}
          onChange={(brandColor) => patch({ brandColor })}
        />
      </div>

      <aside className="space-y-2" aria-label={t("onboarding.identity.previewLabel")}>
        <p className="text-xs font-medium text-muted-foreground">
          {t("onboarding.identity.previewHeading")}
        </p>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl font-heading font-semibold text-white"
              style={{ backgroundColor: draft.brandColor }}
              aria-hidden
            >
              {previewInitials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading font-semibold">
                {draft.name || t("onboarding.identity.newClient")}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{draft.handle || t("onboarding.identity.handleFallback")}
              </p>
            </div>
          </div>
          {categoryLabel ? (
            <p className="mt-3 text-xs text-muted-foreground">{t(categoryLabel)}</p>
          ) : null}
          {draft.bio ? (
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{draft.bio}</p>
          ) : null}
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {draft.timezone}
          </p>
        </div>
      </aside>
    </div>
  )
}
