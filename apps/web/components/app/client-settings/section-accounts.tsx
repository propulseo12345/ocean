"use client"

import { ExternalLink, Info, Link2Off, RefreshCw, Waypoints } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { AccountStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatFollowers } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import type { SocialAccount } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { SectionCard } from "./section-card"

// Honnêteté sur les contraintes réelles des plateformes (analyse §2.1).
const PLATFORM_NOTES: Partial<Record<SocialAccount["platform"], string>> = {
  instagram: "Nécessite un compte Pro relié à une Page Facebook (variante Instagram Login).",
  facebook: "Publication via la Page liée, attribuée par le client dans la Business Suite.",
  tiktok:
    "Mode brouillon uniquement : le post est poussé, le client le finalise dans l'app TikTok.",
}

export function SectionAccounts({ accounts }: { accounts: SocialAccount[] }) {
  return (
    <SectionCard
      icon={Waypoints}
      title="Comptes connectés"
      description="Réseaux sur lesquels ce client publie. La connexion OAuth se fait dans les réglages globaux."
      action={
        <Button size="sm" variant="outline" render={<Link href={routes.settings} />}>
          Gérer les connexions
          <ExternalLink />
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <EmptyState
          icon={Link2Off}
          title="Aucun compte connecté"
          description="Connecte Instagram, Facebook ou TikTok depuis les réglages des connexions pour publier pour ce client."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        La santé des accès est surveillée en continu : un accès expiré est détecté avant l'heure de
        publication, jamais après.
      </p>
    </SectionCard>
  )
}

function AccountRow({ account }: { account: SocialAccount }) {
  const meta = platformMeta[account.platform]
  const needsAttention = account.status !== "connected"
  const note = PLATFORM_NOTES[account.platform]

  function reconnect() {
    toast.info(`Reconnexion ${meta.label} simulée (aperçu)`, {
      description: "Aucun compte n'est réellement reconnecté pendant la preview.",
    })
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <PlatformIcon platform={account.platform} className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {meta.label}
          <span className="truncate font-normal text-muted-foreground">@{account.username}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatFollowers(account.followers)} abonnés
          {note ? <span className="hidden sm:inline"> · {note}</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountStatusBadge status={account.status} />
        {needsAttention ? (
          <Button size="sm" variant="outline" onClick={reconnect}>
            <RefreshCw />
            <span className="hidden sm:inline">Reconnecter</span>
          </Button>
        ) : null}
      </div>
    </li>
  )
}
