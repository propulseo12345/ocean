"use client"

import { AlertTriangle, Clock, Copy, Mail, RotateCcw, UserMinus, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { inviteReviewer, removeClientMember, revokeInvitation } from "@/lib/actions/collaboration"
import type { ClientMemberRow, PendingInvitation } from "@/lib/data/pro"
import { useFormat, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// Ticket P7-7 — l'écran qui manquait.
//
// Une invitation ratée était définitive : aucune liste, aucune ré-invitation,
// aucune révocation, aucun retrait de `client_members`. La règle 4 exige qu'une
// révocation soit effective IMMÉDIATEMENT — c'est la raison pour laquelle ce
// projet refuse les claims JWT d'autorisation et relit deux tables
// d'appartenance à chaque requête. Cette promesse tenait sans qu'aucun bouton ne
// permette de la prononcer.

export function ReviewerAccessList({
  clientId,
  members,
  invitations,
}: {
  clientId: string
  members: ClientMemberRow[]
  invitations: PendingInvitation[]
}) {
  const t = useT()
  const f = useFormat()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  function run(key: string, fn: () => Promise<{ ok: boolean }>, successKey: string) {
    setBusy(key)
    startTransition(async () => {
      const res = await fn()
      setBusy(null)
      if (!res.ok) {
        toast.error(t("clientSettings.access.actionError"))
        return
      }
      toast.success(t(successKey as never))
      router.refresh()
    })
  }

  async function reinvite(email: string) {
    setBusy(`reinvite:${email}`)
    const res = await inviteReviewer({ clientId, email })
    setBusy(null)
    if (!res.ok || !res.data) {
      toast.error(
        res.ok === false && res.error === "already_member"
          ? t("clientSettings.access.alreadyMember")
          : t("clientSettings.access.actionError")
      )
      return
    }
    const lien = `${window.location.origin}${routes.acceptInvite(res.data.token)}`
    toast.success(t("clientSettings.access.reinvited"), {
      duration: 30_000,
      action: {
        label: t("clientSettings.access.copyLink"),
        onClick: () => {
          navigator.clipboard.writeText(lien)
          toast.success(t("clientSettings.access.linkCopied"))
        },
      },
    })
    router.refresh()
  }

  if (members.length === 0 && invitations.length === 0) return null

  return (
    <div className="divide-y rounded-lg border">
      {invitations.map((inv) => (
        <div key={inv.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {inv.expired ? <AlertTriangle className="size-3.5" /> : <Clock className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{inv.email}</p>
            <p className="text-xs text-muted-foreground">
              {inv.expired
                ? t("clientSettings.access.invitationExpired", {
                    when: f.relative(inv.expiresAt),
                  })
                : t("clientSettings.access.invitationPending", {
                    when: f.relative(inv.expiresAt),
                  })}
            </p>
          </div>
          {/* Ré-inviter tue l'ancien jeton et en émet un neuf (RPC 032). */}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => reinvite(inv.email)}>
            {busy === `reinvite:${inv.email}` ? (
              <Copy className="size-4" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            <span className="hidden sm:inline">{t("clientSettings.access.reinvite")}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                `revoke:${inv.id}`,
                () => revokeInvitation({ clientId, invitationId: inv.id }),
                "clientSettings.access.revoked"
              )
            }
          >
            <XCircle className="size-4" />
            <span className="hidden sm:inline">{t("clientSettings.access.revoke")}</span>
          </Button>
        </div>
      ))}

      {members.map((m) => (
        <div key={m.userId} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {m.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.name}</p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Mail className="size-3" />
              {m.email}
            </p>
          </div>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {m.lastActiveAt
              ? t("clientSettings.approval.seenAt", { when: f.relative(m.lastActiveAt) })
              : t("clientSettings.approval.neverVisited")}
          </span>
          {/* Règle 4 : la révocation doit être effective immédiatement. */}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                `remove:${m.userId}`,
                () => removeClientMember({ clientId, userId: m.userId }),
                "clientSettings.access.removed"
              )
            }
          >
            <UserMinus className="size-4" />
            <span className="hidden sm:inline">{t("clientSettings.access.remove")}</span>
          </Button>
        </div>
      ))}
    </div>
  )
}
