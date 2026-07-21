import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

export default function PortalNotFound() {
  return (
    <EmptyState
      title="Contenu introuvable"
      description="Ce contenu n'est pas disponible dans ton espace de validation."
      action={
        <Button variant="outline" render={<Link href={routes.portal} />}>
          Retour au portail
        </Button>
      }
    />
  )
}
