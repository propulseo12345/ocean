"use client"

import { Check, Copy, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inviteReviewer } from "@/lib/actions/collaboration"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// Invitation d'un relecteur au portail de validation. Crée réellement la ligne
// client_invitations (inviteReviewer) ; l'ENVOI de l'email est différé (Brevo,
// Tier D). En attendant, on affiche le lien d'accès à partager manuellement.

export function ReviewerInviteDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setEmail("")
    setSubmitting(false)
    setLink(null)
    setCopied(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function submit() {
    if (submitting || email.trim().length === 0) return
    setSubmitting(true)
    const res = await inviteReviewer({ clientId, email: email.trim() })
    setSubmitting(false)
    if (!res.ok || !res.data) {
      const key =
        res.ok === false && res.error === "already_invited"
          ? "clientSettings.approval.inviteAlreadyInvited"
          : res.ok === false && res.error === "invalid_input"
            ? "clientSettings.approval.inviteInvalid"
            : "clientSettings.approval.inviteError"
      toast.error(t(key))
      return
    }
    // Lien d'accès absolu (le token est en clair, usage unique). window est sûr :
    // ce composant est 'use client', submit ne s'exécute qu'au clic.
    setLink(`${window.location.origin}${routes.acceptInvite(res.data.token)}`)
    router.refresh()
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success(t("clientSettings.approval.inviteCopied"))
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : le champ reste
      // sélectionnable manuellement, pas d'échec bloquant.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {link
              ? t("clientSettings.approval.inviteSuccessTitle")
              : t("clientSettings.approval.inviteDialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {link
              ? t("clientSettings.approval.inviteSuccessDescription")
              : t("clientSettings.approval.inviteDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="grid gap-1.5">
            <Label htmlFor="invite-link">{t("clientSettings.approval.inviteLinkLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="invite-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button type="button" size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check /> : <Copy />}
                <span className="sr-only">{t("clientSettings.approval.inviteCopy")}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">{t("clientSettings.approval.inviteEmailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("clientSettings.approval.inviteEmailPlaceholder")}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          {link ? (
            <Button onClick={() => handleOpenChange(false)}>
              {t("clientSettings.approval.inviteDone")}
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting || email.trim().length === 0}>
              <Send />
              {submitting
                ? t("clientSettings.approval.inviteSubmitting")
                : t("clientSettings.approval.inviteSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
