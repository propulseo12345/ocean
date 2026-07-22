"use client"

import { UserRound } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ClientAvatar } from "@/components/shared/client-avatar"
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
import { updateClientProfile } from "@/lib/actions/clients"
import type { Client } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { BrandColorPalette } from "./brand-color-palette"
import { SaveBar, SectionCard } from "./section-card"

// Fuseaux usuels des clients FR + Amérique du Nord (mocks Studio Rise).
const TIMEZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Lisbon",
  "Europe/London",
  "America/Montreal",
  "America/New_York",
]

export function SectionProfile({ client }: { client: Client }) {
  const t = useT()
  const initialCategory = client.category
  const initialBio = client.bio
  const initialNotes = client.notes ? client.notes : ""

  const [name, setName] = useState(client.name)
  const [handle, setHandle] = useState(client.handle)
  const [category, setCategory] = useState(initialCategory)
  const [bio, setBio] = useState(initialBio)
  const [timezone, setTimezone] = useState(client.timezone)
  const [brandColor, setBrandColor] = useState(client.brandColor)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  const dirty =
    name !== client.name ||
    handle !== client.handle ||
    category !== initialCategory ||
    bio !== initialBio ||
    timezone !== client.timezone ||
    brandColor !== client.brandColor ||
    notes !== initialNotes

  async function save() {
    if (saving) return
    setSaving(true)
    const res = await updateClientProfile({
      clientId: client.id,
      name,
      handle,
      category,
      bio,
      timezone,
      brandColor,
      notes,
    })
    setSaving(false)
    if (res.ok) {
      toast.success(t("clientSettings.profile.savedToast"), {
        description: t("clientSettings.profile.savedToastDescription"),
      })
    } else {
      toast.error(
        res.ok === false && res.error === "handle_taken"
          ? t("clientSettings.profile.handleTaken")
          : t("clientSettings.profile.saveError")
      )
    }
  }

  const preview: Client = { ...client, name, brandColor }

  return (
    <SectionCard
      icon={UserRound}
      title={t("clientSettings.profile.title")}
      description={t("clientSettings.profile.description")}
    >
      <div className="flex items-center gap-3">
        <ClientAvatar client={preview} size={48} className="rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {name || t("clientSettings.profile.noName")}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{handle || t("clientSettings.profile.handleFallback")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cl-name" label={t("clientSettings.profile.nameLabel")}>
          <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="cl-handle" label={t("clientSettings.profile.handleLabel")}>
          <Input id="cl-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </Field>
        <Field id="cl-category" label={t("clientSettings.profile.categoryLabel")}>
          <Input
            id="cl-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("clientSettings.profile.categoryPlaceholder")}
          />
        </Field>
        <Field
          id="cl-tz"
          label={t("clientSettings.profile.timezoneLabel")}
          hint={t("clientSettings.profile.timezoneHint")}
        >
          <Select value={timezone} onValueChange={(v) => setTimezone(String(v))}>
            <SelectTrigger id="cl-tz" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id="cl-bio" label={t("clientSettings.profile.bioLabel")}>
        <Textarea id="cl-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>

      <div className="space-y-2">
        <Label>{t("clientSettings.profile.brandColorLabel")}</Label>
        <BrandColorPalette value={brandColor} onChange={setBrandColor} />
      </div>

      <Field
        id="cl-notes"
        label={t("clientSettings.profile.notesLabel")}
        hint={t("clientSettings.profile.notesHint")}
      >
        <Textarea
          id="cl-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("clientSettings.profile.notesPlaceholder")}
        />
      </Field>

      <SaveBar dirty={dirty} onSave={save} />
    </SectionCard>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
