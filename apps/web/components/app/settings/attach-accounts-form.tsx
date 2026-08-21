"use client"

import { Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { attachSocialAccounts } from "@/lib/actions/social-accounts"
import { useT } from "@/lib/i18n"
import { type AvailableSubAccount, cleDeSousCompte } from "@/lib/oauth/sub-accounts"
import { cn } from "@/lib/utils"

// Formulaire de rattachement (P8-1). Rien n'est coché par défaut, et c'est
// délibéré : tout pré-cocher reproduirait le comportement qu'on corrige, en
// laissant croire à un choix.

export function AttachAccountsForm({
  connectionId,
  available,
  clients,
  defaultClientId,
}: {
  connectionId: string
  available: AvailableSubAccount[]
  clients: Array<{ id: string; name: string }>
  defaultClientId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [clientId, setClientId] = useState<string | null>(defaultClientId ?? clients[0]?.id ?? null)
  const [keys, setKeys] = useState<string[]>([])

  function toggle(cle: string) {
    setKeys((k) => (k.includes(cle) ? k.filter((x) => x !== cle) : [...k, cle]))
  }

  function submit() {
    if (!clientId || keys.length === 0) return
    startTransition(async () => {
      const res = await attachSocialAccounts({ clientId, connectionId, keys })
      if (!res.ok) {
        toast.error(t("settings.attach.error"))
        return
      }
      toast.success(t("settings.attach.done", { count: res.data?.attached ?? 0 }))
      router.push("/settings/accounts")
      router.refresh()
    })
  }

  if (available.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("settings.attach.empty")}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.attach.chooseClient")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="attach-client">{t("settings.attach.clientLabel")}</Label>
          <select
            id="attach-client"
            value={clientId ?? ""}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("settings.attach.clientHint")}</p>
        </div>

        <ul className="space-y-2">
          {available.map((compte) => {
            const cle = cleDeSousCompte(compte.platform, compte.providerAccountId)
            const coché = keys.includes(cle)
            return (
              <li key={cle}>
                <button
                  type="button"
                  onClick={() => toggle(cle)}
                  aria-pressed={coché}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    coché ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      coché ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    )}
                  >
                    {coché ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {compte.displayName ?? compte.username ?? compte.providerAccountId}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {compte.platform}
                      {compte.username ? ` · @${compte.username}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t("settings.attach.selected", { count: keys.length })}
          </p>
          <Button onClick={submit} disabled={pending || keys.length === 0 || !clientId}>
            {t("settings.attach.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
