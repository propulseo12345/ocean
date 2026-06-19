import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BoardIdeaBank } from "@/components/app/studio/board-idea-bank"
import { getClient, getContentItems, getPillars } from "@/lib/mocks"

export const metadata: Metadata = { title: "Banque d'idées" }

export default async function ClientIdeasPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const client = getClient(clientId)
  if (!client) notFound()

  const ideas = getContentItems(clientId).filter((it) => it.status === "idea")

  return <BoardIdeaBank client={client} ideas={ideas} pillars={getPillars(clientId)} />
}
