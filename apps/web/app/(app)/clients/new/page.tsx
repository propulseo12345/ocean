import type { Metadata } from "next"
import Link from "next/link"
import { WizardShell } from "@/components/app/onboarding/wizard-shell"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { getT } from "@/lib/i18n/server"
import { routes } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("clients.newClientTitle") }
}

export default async function NewClientPage() {
  const t = await getT()
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.newClientTitle")}
        description={t("clients.newClientDescription")}
        actions={
          <Button variant="outline" render={<Link href={routes.clients} />}>
            {t("common.cancel")}
          </Button>
        }
      />
      <WizardShell />
    </div>
  )
}
