import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

export default async function ClientIndexPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  redirect(routes.clientGrid(clientId))
}
