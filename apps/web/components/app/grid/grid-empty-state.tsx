import { ImageIcon, Plus, Settings } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

// État vide de la grille — avec actions concrètes (audit §1.2 : zéro CTA avant).
export function GridEmptyState({ clientId }: { clientId: string }) {
  return (
    <EmptyState
      icon={ImageIcon}
      title="Aucun contenu à afficher"
      description="Connecte un compte Instagram pour importer le feed existant, ou crée du contenu dans le studio."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href={routes.clientContent(clientId)} />}>
            <Plus />
            Créer un contenu
          </Button>
          <Button variant="outline" render={<Link href={routes.settings} />}>
            <Settings />
            Connecter un compte
          </Button>
        </div>
      }
    />
  )
}
