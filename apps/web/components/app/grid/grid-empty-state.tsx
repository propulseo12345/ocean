import { ImageIcon, Plus, Settings } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// État vide de la grille — avec actions concrètes (audit §1.2 : zéro CTA avant).
export function GridEmptyState({ clientId }: { clientId: string }) {
  const t = useT()
  return (
    <EmptyState
      icon={ImageIcon}
      title={t("grid.empty.title")}
      description={t("grid.empty.description")}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href={routes.clientContent(clientId)} />}>
            <Plus />
            {t("grid.empty.createContent")}
          </Button>
          <Button variant="outline" render={<Link href={routes.settings} />}>
            <Settings />
            {t("grid.empty.connectAccount")}
          </Button>
        </div>
      }
    />
  )
}
