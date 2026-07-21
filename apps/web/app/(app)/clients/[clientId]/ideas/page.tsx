import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BoardIdeaBank } from "@/components/app/studio/board-idea-bank"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClient, getContentItems, getPillars } from "@/lib/data"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.metaIdeas") }
}

export default async function ClientIdeasPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const ctx = await getActiveOrg()
  const client = await getClient(ctx.org.id, clientId)
  if (!client) notFound()

  const ideas = (await getContentItems(ctx.org.id, clientId)).filter((it) => it.status === "idea")

  return (
    <BoardIdeaBank client={client} ideas={ideas} pillars={await getPillars(ctx.org.id, clientId)} />
  )
}
