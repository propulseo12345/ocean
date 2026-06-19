"use client"

import { Info } from "lucide-react"
import { AccountConnectCard } from "./account-connect-card"
import type { ClientDraft, DraftSocialAccount } from "./wizard-types"

// Étape 2 — comptes sociaux : connexion mock par plateforme. Aucun compte n'est
// strictement requis (on peut finir sans) ; Instagram est recommandé pour la grille.

export function StepAccounts({
  draft,
  patch,
}: {
  draft: ClientDraft
  patch: (partial: Partial<ClientDraft>) => void
}) {
  function update(next: DraftSocialAccount) {
    patch({
      accounts: draft.accounts.map((a) => (a.platform === next.platform ? next : a)),
    })
  }

  const connectedCount = draft.accounts.filter((a) => a.connected).length
  const igConnected = draft.accounts.find((a) => a.platform === "instagram")?.connected

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-info">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          La connexion réelle se fait via l'autorisation officielle de chaque plateforme. Ici, en
          aperçu, on simule la liaison. Vous pourrez tout connecter (ou reconnecter) plus tard
          depuis les réglages — aucun compte n'est obligatoire pour créer le client.
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {draft.accounts.map((account) => (
          <AccountConnectCard key={account.platform} account={account} onChange={update} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {connectedCount} compte{connectedCount > 1 ? "s" : ""} connecté
          {connectedCount > 1 ? "s" : ""} (aperçu)
        </span>
        {!igConnected ? (
          <span className="text-warning">Instagram est recommandé pour la grille de feed.</span>
        ) : null}
      </div>
    </div>
  )
}
