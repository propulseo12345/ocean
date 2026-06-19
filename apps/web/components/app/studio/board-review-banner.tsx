"use client"

import { BellRing, Send } from "lucide-react"
import { toast } from "sonner"
import { ReviewStateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatRelative } from "@/lib/format"
import type { ContentItem, ReviewRequestState } from "@/lib/mocks/types"
import type { BoardState } from "./board-state"

// Bandeau de suivi de la demande de validation en cours : N envoyés ·
// M approuvés · retours · dernière activité du reviewer · relance (aperçu).

const APPROVED_LIKE: ContentItem["status"][] = [
  "approved",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
]

export function BoardReviewBanner({ board }: { board: BoardState }) {
  const { request, reviewer } = board
  if (!request) return null

  const inRequest = board.boardItems.filter((it) => request.contentIds.includes(it.id))
  const approved = inRequest.filter((it) => APPROVED_LIKE.includes(it.status)).length
  const changes = inRequest.filter((it) => it.status === "changes_requested").length
  const pending = inRequest.filter((it) => it.status === "in_review").length

  const state: ReviewRequestState =
    pending === 0 && approved + changes > 0
      ? "done"
      : approved + changes > 0
        ? "partial"
        : "pending"

  const seenLabel =
    reviewer === null
      ? null
      : reviewer.lastActiveAt === null
        ? `${reviewer.name} n'a jamais ouvert le portail`
        : `${reviewer.name} a ouvert le portail ${formatRelative(reviewer.lastActiveAt)}`

  function remind() {
    board.remind()
    toast.success("Relance envoyée (aperçu)", {
      description: reviewer
        ? `${reviewer.name} recevrait un email Brevo avec le lien direct du portail.`
        : "Le reviewer recevrait un email Brevo avec le lien direct du portail.",
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-info/30 bg-info/5 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Send className="size-4 text-info" />
        Demande de validation
        <ReviewStateBadge state={state} />
      </span>

      <span className="text-xs text-muted-foreground tabular-nums">
        {request.contentIds.length} envoyé{request.contentIds.length > 1 ? "s" : ""}{" "}
        {formatRelative(request.sentAt)} · {approved} approuvé{approved > 1 ? "s" : ""} · {changes}{" "}
        retour{changes > 1 ? "s" : ""} · {pending} en attente
      </span>

      {seenLabel ? <span className="text-xs text-muted-foreground">{seenLabel}</span> : null}

      <span className="ml-auto flex items-center gap-2">
        {board.reminders > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {board.reminders} relance{board.reminders > 1 ? "s" : ""} envoyée
            {board.reminders > 1 ? "s" : ""} (aperçu)
          </span>
        ) : null}
        {pending > 0 ? (
          <Button variant="outline" size="sm" onClick={remind}>
            <BellRing />
            Relancer (aperçu)
          </Button>
        ) : null}
      </span>
    </div>
  )
}
