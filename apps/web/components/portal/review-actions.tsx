"use client"

import { Check, MessageSquarePlus, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitReviewDecision } from "@/lib/actions/collaboration"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function ReviewActions({
  contentId,
  contentTitle,
}: {
  contentId: string
  contentTitle: string
}) {
  const t = useT()
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "changes">("idle")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  // Décision de validation du reviewer : approuver ou demander des modifs (avec
  // message). Passe par la RPC submit_review_decision (change le statut + trace
  // l'approbation immuable) ; l'autorisation est tranchée par la RLS/RPC.
  async function decide(decision: "approved" | "changes_requested", label: string) {
    if (pending) return
    setPending(true)
    const res = await submitReviewDecision({
      contentItemId: contentId,
      decision,
      message: decision === "changes_requested" ? message.trim() : null,
    })
    setPending(false)
    if (!res.ok) {
      toast.error(t("portal.review.decisionError"))
      return
    }
    toast.success(t("portal.review.decisionRecorded"), {
      description: t("portal.review.decisionDetail", { label, title: contentTitle }),
    })
    setMode("idle")
    setMessage("")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          className="bg-success text-white hover:bg-success/90"
          onClick={() => decide("approved", t("portal.review.approved"))}
          disabled={pending}
        >
          <Check />
          {t("portal.review.approve")}
        </Button>
        <Button
          size="lg"
          variant={mode === "changes" ? "secondary" : "outline"}
          onClick={() => setMode(mode === "changes" ? "idle" : "changes")}
        >
          <MessageSquarePlus />
          {t("portal.review.requestChanges")}
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-all",
          mode === "changes" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("portal.review.changesPlaceholder")}
              rows={3}
              aria-label={t("portal.review.changesAriaLabel")}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("idle")}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => decide("changes_requested", t("portal.review.changesRequested"))}
                disabled={pending || message.trim().length === 0}
              >
                <Send />
                {t("portal.review.sendRequest")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("portal.review.footnote")}</p>
    </div>
  )
}
