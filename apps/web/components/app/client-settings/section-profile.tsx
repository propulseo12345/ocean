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
import type { Client } from "@/lib/mocks/types"
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
  const [name, setName] = useState(client.name)
  const [handle, setHandle] = useState(client.handle)
  const [category, setCategory] = useState(client.category)
  const [bio, setBio] = useState(client.bio)
  const [timezone, setTimezone] = useState(client.timezone)
  const [brandColor, setBrandColor] = useState(client.brandColor)
  const [notes, setNotes] = useState(client.notes ?? "")

  const dirty =
    name !== client.name ||
    handle !== client.handle ||
    category !== client.category ||
    bio !== client.bio ||
    timezone !== client.timezone ||
    brandColor !== client.brandColor ||
    notes !== (client.notes ?? "")

  function save() {
    toast.success("Profil enregistré (aperçu)", {
      description: "Aucune donnée n'est réellement modifiée pendant la preview.",
    })
  }

  const preview: Client = { ...client, name, brandColor }

  return (
    <SectionCard
      icon={UserRound}
      title="Profil du client"
      description="Identité affichée dans l'app, l'aperçu de profil et le portail de validation."
    >
      <div className="flex items-center gap-3">
        <ClientAvatar client={preview} size={48} className="rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name || "Sans nom"}</p>
          <p className="truncate text-xs text-muted-foreground">@{handle || "handle"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cl-name" label="Nom">
          <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="cl-handle" label="Identifiant (@handle)">
          <Input id="cl-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </Field>
        <Field id="cl-category" label="Catégorie">
          <Input
            id="cl-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex. : Café · Torréfaction artisanale"
          />
        </Field>
        <Field
          id="cl-tz"
          label="Fuseau horaire"
          hint="Utilisé pour dater les publications du client."
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

      <Field id="cl-bio" label="Bio">
        <Textarea id="cl-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>

      <div className="space-y-2">
        <Label>Couleur de marque</Label>
        <BrandColorPalette value={brandColor} onChange={setBrandColor} />
      </div>

      <Field
        id="cl-notes"
        label="Notes internes"
        hint="Visible uniquement par toi (forfait, délais, préférences) — jamais partagé au client."
      >
        <Textarea
          id="cl-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex. : Forfait 12 posts/mois. Prévoir 48 h de validation."
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
