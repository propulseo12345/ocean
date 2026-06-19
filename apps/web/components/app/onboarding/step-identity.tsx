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
  const previewInitials = initials(draft.name || "Nouveau client")

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">
              Nom du client <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cl-name"
              ref={firstFieldRef}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Ex. Brûlerie Lacaze"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-handle">
              Identifiant <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cl-handle"
                value={draft.handle}
                onChange={(e) => patch({ handle: normalizeHandle(e.target.value) })}
                placeholder="brulerielacaze"
                className="pl-7"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">Le @ du compte principal, sans espace.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cl-category">Catégorie</Label>
            <Select value={draft.category} onValueChange={(v) => patch({ category: String(v) })}>
              <SelectTrigger id="cl-category" className="w-full">
                <SelectValue placeholder="Choisir une activité" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-tz">Fuseau horaire du client</Label>
            <Select value={draft.timezone} onValueChange={(v) => patch({ timezone: String(v) })}>
              <SelectTrigger id="cl-tz" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Les publications seront planifiées à l'heure locale du client.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cl-bio">Bio</Label>
          <Textarea
            id="cl-bio"
            value={draft.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            placeholder="La présentation affichée sur le profil — quelques lignes suffisent."
            rows={3}
          />
        </div>

        <BrandColorPalette
          value={draft.brandColor}
          onChange={(brandColor) => patch({ brandColor })}
        />
      </div>

      <aside className="space-y-2" aria-label="Aperçu de la fiche client">
        <p className="text-xs font-medium text-muted-foreground">Aperçu</p>
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
                {draft.name || "Nouveau client"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{draft.handle || "identifiant"}
              </p>
            </div>
          </div>
          {draft.category ? (
            <p className="mt-3 text-xs text-muted-foreground">{draft.category}</p>
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
