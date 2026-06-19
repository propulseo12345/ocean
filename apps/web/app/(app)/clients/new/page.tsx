import type { Metadata } from "next"
import Link from "next/link"
import { WizardShell } from "@/components/app/onboarding/wizard-shell"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

export const metadata: Metadata = { title: "Nouveau client" }

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouveau client"
        description="Créez un espace de travail isolé : identité, comptes, marque et stratégie en quelques étapes."
        actions={
          <Button variant="outline" render={<Link href={routes.clients} />}>
            Annuler
          </Button>
        }
      />
      <WizardShell />
    </div>
  )
}
