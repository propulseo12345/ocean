import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ContentRefMap } from "@/components/app/library/library-types"
import { LibraryWorkspace } from "@/components/app/library/library-workspace"
import { getClient, getContentItems, getLibraryAssets } from "@/lib/mocks"
import { routes } from "@/lib/routes"

export const metadata: Metadata = { title: "Médiathèque" }

// Médiathèque par client (audit §4, P0) : la banque de médias dans laquelle
// le composer pioche déjà — usages réels calculés depuis les mocks.

export default async function ClientLibraryPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client || client.archivedAt) notFound()

  const assets = getLibraryAssets(clientId)

  // Références des contenus utilisant au moins un asset → liens vers le studio.
  const referenced = new Set(assets.flatMap((a) => a.usedInContentIds))
  const contentRefs: ContentRefMap = Object.fromEntries(
    getContentItems(clientId)
      .filter((c) => referenced.has(c.id))
      .map((c) => [
        c.id,
        { id: c.id, title: c.title, status: c.status, href: routes.content(clientId, c.id) },
      ])
  )

  return <LibraryWorkspace client={client} initialAssets={assets} contentRefs={contentRefs} />
}
