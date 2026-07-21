import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ContentRefMap } from "@/components/app/library/library-types"
import { LibraryWorkspace } from "@/components/app/library/library-workspace"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClient, getContentItems, getLibraryAssets } from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaLibrary") }
}

// Médiathèque par client (audit §4, P0) : la banque de médias dans laquelle
// le composer pioche déjà — usages réels calculés depuis les mocks.

export default async function ClientLibraryPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client || client.archivedAt) notFound()

  const assets = await getLibraryAssets(ctx.org.id, clientId)

  // Références des contenus utilisant au moins un asset → liens vers le studio.
  // title reste string : la médiathèque le résout à l'affichage via pick().
  const referenced = new Set(assets.flatMap((a) => a.usedInContentIds))
  const contentItems = await getContentItems(ctx.org.id, clientId)
  const contentRefs: ContentRefMap = Object.fromEntries(
    contentItems
      .filter((c) => referenced.has(c.id))
      .map((c) => [
        c.id,
        { id: c.id, title: c.title, status: c.status, href: routes.content(clientId, c.id) },
      ])
  )

  return <LibraryWorkspace client={client} initialAssets={assets} contentRefs={contentRefs} />
}
