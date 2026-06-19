import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User } from "@/lib/mocks/types"

export function ProfileTab({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Profil</CardTitle>
        <CardDescription>
          Informations de ton compte. La modification arrivera dans une prochaine version.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-1 sm:max-w-md">
        <Field id="profile-name" label="Nom" value={user.name} />
        <Field id="profile-email" label="Adresse e-mail" value={user.email} type="email" />
        <Field
          id="profile-tz"
          label="Fuseau horaire"
          value={user.timezone}
          hint="Utilisé pour afficher ton agenda unifié."
        />
      </CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  value,
  type = "text",
  hint,
}: {
  id: string
  label: string
  value: string
  type?: string
  hint?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} defaultValue={value} disabled readOnly />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
