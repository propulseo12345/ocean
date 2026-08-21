import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AttachAccountsForm } from "@/components/app/settings/attach-accounts-form"
import { PageHeader } from "@/components/shared/page-header"
import { getActiveOrg } from "@/lib/auth/org-context"
import { getClients } from "@/lib/data"
import { getT } from "@/lib/i18n/server"
import { parseAvailableSubAccounts } from "@/lib/oauth/sub-accounts"
import { createClient } from "@/lib/supabase/server"

// P8-1 — l'écran qui manquait.
//
// Le callback OAuth rattachait auparavant TOUS les comptes découverts au client
// depuis lequel la connexion avait été lancée. Ici, l'utilisateur voit ce que le
// fournisseur a réellement donné, et choisit — compte par compte, client par
// client. Tant qu'il n'a rien coché, rien n'est publiable : c'est le sens du
// ticket, et c'est aussi plus honnête que de deviner.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("settings.attach.title") }
}

export default async function AttachAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>
  searchParams: Promise<{ client?: string }>
}) {
  const { connectionId } = await params
  const { client: clientHint } = await searchParams
  const t = await getT()
  const ctx = await getActiveOrg()

  // Lecture sous RLS (client utilisateur, pas admin) : une connexion d'une autre
  // org n'est tout simplement pas visible.
  const supabase = await createClient()
  const { data: connection } = await supabase
    .from("platform_connections")
    .select("id, provider, provider_account_name, metadata")
    .eq("id", connectionId)
    .eq("org_id", ctx.org.id)
    .maybeSingle()
  if (!connection) notFound()

  const available = parseAvailableSubAccounts(connection.metadata)
  const clients = (await getClients(ctx.org.id)).filter((c) => !c.archivedAt)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.attach.title")}
        description={t("settings.attach.description", {
          account: connection.provider_account_name ?? connection.provider,
        })}
      />
      <AttachAccountsForm
        connectionId={connection.id}
        available={available}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultClientId={clientHint && clients.some((c) => c.id === clientHint) ? clientHint : null}
      />
    </div>
  )
}
