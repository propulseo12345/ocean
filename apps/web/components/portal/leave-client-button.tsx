"use client"

import { LogOut } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { leaveClient } from "@/lib/actions/collaboration"
import { useT } from "@/lib/i18n"

// Sortie de secours du portail (ticket V-3, migration 034).
//
// Jusqu'ici, quitter un client était IMPOSSIBLE pour un reviewer :
// `client_members_delete` (004:101-103) exige d'être membre de l'organisation
// propriétaire, ce qu'un reviewer n'est jamais (règle 6). Seule l'agence qui
// l'avait inscrit pouvait le retirer.
//
// C'était l'aggravant de la CSRF : une adhésion créée à l'insu de quelqu'un,
// dans le client d'un attaquant, n'était révocable que par cet attaquant. La
// CSRF est fermée en amont ; ce bouton rend l'état réparable par la personne
// concernée, quelle que soit la manière dont l'adhésion a été créée.
//
// Confirmation en deux temps, sans boîte de dialogue : l'action est destructive
// et sans annulation possible, mais elle doit rester atteignable sur un écran de
// téléphone — le portail est d'abord consulté depuis un mobile.

export function LeaveClientButton({
  clientId,
  clientNom,
}: {
  clientId: string
  clientNom: string
}) {
  const t = useT()
  const [confirme, setConfirme] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirme) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setConfirme(true)}
      >
        <LogOut className="size-4" />
        {t("portal.leave.trigger")}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-medium">
        {t("portal.leave.confirmQuestion", { client: clientNom })}
      </p>
      <p className="text-sm text-muted-foreground">{t("portal.leave.confirmDetail")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await leaveClient({ clientId })
              if (res.ok) {
                toast.success(t("portal.leave.done"))
              } else {
                toast.error(t("portal.leave.error"))
                setConfirme(false)
              }
            })
          }
        >
          <LogOut className="size-4" />
          {t("portal.leave.confirm")}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirme(false)}>
          {t("portal.leave.cancel")}
        </Button>
      </div>
    </div>
  )
}
