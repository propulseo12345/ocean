"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User } from "@/lib/domain"
import { useT } from "@/lib/i18n"

export function ProfileTab({ user }: { user: User }) {
  const t = useT()
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">{t("settings.profile.title")}</CardTitle>
        <CardDescription>{t("settings.profile.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-1 sm:max-w-md">
        <Field id="profile-name" label={t("settings.profile.name")} value={user.name} />
        <Field
          id="profile-email"
          label={t("settings.profile.email")}
          value={user.email}
          type="email"
        />
        <Field
          id="profile-tz"
          label={t("settings.profile.timezone")}
          value={user.timezone}
          hint={t("settings.profile.timezoneHint")}
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
