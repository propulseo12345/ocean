import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SettingsShell } from "@/components/app/client-settings/settings-shell"
import {
  getBrandKit,
  getClient,
  getPillars,
  getRecurringSlots,
  getReviewer,
  getSocialAccounts,
  getTrashedContent,
} from "@/lib/mocks"

export const metadata: Metadata = { title: "Réglages" }

// Réglages du client (audit §4/§5, P1) : profil, comptes, brand kit, niveau de
// validation, créneaux récurrents, cadence et archivage. Preview UI-only :
// toutes les écritures sont locales (useState) + toasts « (aperçu) ».

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client || client.archivedAt) notFound()

  return (
    <SettingsShell
      client={client}
      accounts={getSocialAccounts(clientId)}
      brandKit={getBrandKit(clientId)}
      reviewer={getReviewer(clientId)}
      slots={getRecurringSlots(clientId)}
      pillars={getPillars(clientId)}
      trashed={getTrashedContent(clientId)}
    />
  )
}
