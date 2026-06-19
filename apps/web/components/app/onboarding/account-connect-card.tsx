"use client"

import { Check, Link2, Unplug } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { platformMeta } from "@/lib/mocks/labels"
import { cn } from "@/lib/utils"
import type { DraftSocialAccount } from "./wizard-types"

// Note honnête par plateforme (contraintes réelles d'intégration).
const PLATFORM_NOTES: Record<string, string> = {
  instagram:
    "Requiert un compte Pro (Business ou Créateur) relié à une Page Facebook. Recommandé pour la grille de feed.",
  facebook: "La publication passe par la Page Facebook liée, pas par un profil personnel.",
  tiktok:
    "Publication en brouillon uniquement : Ocean prépare la vidéo, vous finalisez la légende dans l'app TikTok.",
}

export function AccountConnectCard({
  account,
  onChange,
}: {
  account: DraftSocialAccount
  onChange: (next: DraftSocialAccount) => void
}) {
  const meta = platformMeta[account.platform]
  const [username, setUsername] = useState(account.username)

  function connect() {
    const handle = username.trim().replace(/^@+/, "")
    if (!handle) {
      toast.warning("Renseignez l'identifiant du compte avant de connecter.")
      return
    }
    toast.info(`Redirection OAuth ${meta.label} (aperçu)`, {
      description: "L'autorisation s'ouvrira ici en production — compte marqué connecté (aperçu).",
    })
    onChange({ ...account, username: handle, connected: true })
  }

  function disconnect() {
    onChange({ ...account, connected: false })
    toast.info(`${meta.label} déconnecté (aperçu)`)
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        account.connected ? "border-success/40 bg-success/5" : "bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <PlatformIcon platform={account.platform} className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {meta.label}
            {account.connected ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" />
                Connecté
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{PLATFORM_NOTES[account.platform]}</p>
        </div>
      </div>

      {account.connected ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2">
          <span className="truncate text-sm">@{account.username}</span>
          <Button type="button" variant="ghost" size="sm" onClick={disconnect}>
            <Unplug />
            Déconnecter
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`acc-${account.platform}`} className="text-xs text-muted-foreground">
            Identifiant du compte
          </Label>
          <div className="flex gap-2">
            <Input
              id={`acc-${account.platform}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`@${account.platform === "tiktok" ? "compte.tiktok" : "compte"}`}
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={connect}>
              <Link2 />
              Connecter
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
