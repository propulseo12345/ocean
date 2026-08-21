"use client"

import { LogIn, Mail, UserPlus } from "lucide-react"
import { useActionState } from "react"
import { toast } from "sonner"

import { type ReponseInvitation, repondreInvitation } from "@/app/(auth)/invitations/actions"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

// Bouton de confirmation d'une invitation (ticket V-3).
//
// Rien ici n'est décoratif : c'est ce bouton qui porte l'INTENTION de rejoindre.
// Ouvrir le lien ne rejoint plus rien — il faut ce clic, et la Server Action
// vérifie en plus que la requête vient bien de nos pages.

export function InvitationConfirm({
  token,
  mode,
  clientNom,
}: {
  token: string
  /** `join` : session sur la bonne adresse. `proof` : aucune session. */
  mode: "join" | "proof"
  clientNom: string
}) {
  const t = useT()

  const [state, formAction, pending] = useActionState<ReponseInvitation, FormData>(
    async (prev, formData) => {
      const result = await repondreInvitation(prev, formData)
      if (result?.etat === "refus_cross_site") {
        toast.error(t("auth.invitation.errorTitle"), {
          description: t("auth.invitation.crossSiteDetail"),
        })
      } else if (result?.etat === "indisponible" || result?.etat === "invalide") {
        toast.error(t("auth.invitation.errorTitle"), {
          description: t("auth.invitation.genericDetail"),
        })
      } else if (result?.etat === "preuve_envoyee") {
        toast.success(t("auth.invitation.proofSentTitle"), {
          description: t("auth.invitation.proofSentDescription"),
        })
      }
      return result
    },
    undefined
  )

  // Une fois le lien parti, on ne réaffiche pas le bouton : le rejouer ne ferait
  // qu'envoyer un e-mail de plus.
  if (state?.etat === "preuve_envoyee") {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Mail className="mt-0.5 size-4 shrink-0" />
        {t("auth.invitation.proofSentDescription")}
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {mode === "join" ? <UserPlus /> : <LogIn />}
        {pending
          ? mode === "join"
            ? t("auth.invitation.joinSubmitting")
            : t("auth.invitation.proofSubmitting")
          : mode === "join"
            ? t("auth.invitation.joinSubmit", { client: clientNom })
            : t("auth.invitation.proofSubmit")}
      </Button>
    </form>
  )
}
