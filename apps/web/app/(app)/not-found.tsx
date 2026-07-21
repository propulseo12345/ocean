import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

export default function AppNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Cette vue n'existe pas ou n'est plus accessible."
      action={
        <Button variant="outline" render={<Link href={routes.dashboard} />}>
          Retour au dashboard
        </Button>
      }
    />
  )
}
