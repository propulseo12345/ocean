"use client"

import { Send, TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { MediaThumb } from "@/components/shared/media-thumb"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { pick, useFormat, useLocale, useT } from "@/lib/i18n"
import type { ContentItem, Reviewer } from "@/lib/mocks/types"

// Dialog « Demander une validation » : lot de contenus prêts (brouillons et
// retours corrigés), message au reviewer, récap email mocké (Brevo).

export function BoardReviewDialog({
  open,
  onOpenChange,
  reviewer,
  candidates,
  preselectedIds,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reviewer: Reviewer | null
  /** Contenus éligibles : draft ou changes_requested (corrections faites). */
  candidates: ContentItem[]
  preselectedIds: string[]
  onConfirm: (ids: string[], message: string) => void
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [message, setMessage] = useState("")

  // Réinitialisation à l'ouverture : sélection courante, sinon tout le lot.
  useEffect(() => {
    if (!open) return
    const eligible = candidates.map((c) => c.id)
    const pre = preselectedIds.filter((id) => eligible.includes(id))
    setCheckedIds(pre.length > 0 ? pre : eligible)
    setMessage("")
  }, [open, candidates, preselectedIds])

  function toggle(id: string) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const count = checkedIds.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("studio.reviewDialog.title")}</DialogTitle>
          <DialogDescription>{t("studio.reviewDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {reviewer ? (
            <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 p-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {reviewer.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{reviewer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{reviewer.email}</p>
              </div>
              {reviewer.lastActiveAt === null ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <TriangleAlert className="size-3.5" />
                  {t("studio.reviewDialog.neverConnected")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("studio.reviewDialog.seenAt", { ago: f.relative(reviewer.lastActiveAt) })}
                </span>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
              {t("studio.reviewDialog.noReviewer")}
            </p>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("studio.reviewDialog.readyCount", { count, total: candidates.length })}
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5">
              {candidates.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  {t("studio.reviewDialog.noReady")}
                </p>
              ) : (
                candidates.map((item) => (
                  <Label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 font-normal hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checkedIds.includes(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                    />
                    {item.media[0] ? (
                      <MediaThumb
                        media={item.media[0]}
                        alt=""
                        className="size-9 shrink-0 rounded-md"
                        sizes="36px"
                      />
                    ) : (
                      <span className="size-9 shrink-0 rounded-md bg-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {pick(item.title, locale)}
                    </span>
                    <ContentStatusBadge status={item.status} />
                  </Label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="board-review-message">{t("studio.reviewDialog.messageLabel")}</Label>
            <Textarea
              id="board-review-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("studio.reviewDialog.messagePlaceholder")}
              rows={3}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t("studio.reviewDialog.brevoNote", { count })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={count === 0} onClick={() => onConfirm(checkedIds, message)}>
            <Send />
            {t("studio.reviewDialog.send", { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
