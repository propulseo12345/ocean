"use client"

import { MapPin, Send, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { postComment } from "@/lib/actions/collaboration"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Composeur de remarque du portail (feature « Pastel »). Le reviewer écrit un
// retour, éventuellement épinglé à un point précis d'un visuel.
//
// L'écriture passe par postComment, donc par la RLS de content_comments : un
// reviewer ne peut insérer que visibility='client', sous SA propre identité,
// sur un contenu qui lui est visible. Aucune de ces règles n'est portée ici —
// l'UI ne fait qu'exprimer l'intention.

/** Repère en cours de saisie, avant envoi. Ancré sur la LIAISON content_media. */
export interface DraftAnnotation {
  contentMediaId: string
  /** Index de slide (= content_media.position, 0-based) — pour l'affichage seul. */
  slideIndex: number
  x: number
  y: number
}

export function AnnotationComposer({
  contentId,
  pin,
  picking,
  canPin,
  onTogglePicking,
  onClearPin,
  onPosted,
}: {
  contentId: string
  pin: DraftAnnotation | null
  picking: boolean
  /** Faux si le visuel courant n'a pas d'ancre exploitable (contenu texte seul). */
  canPin: boolean
  onTogglePicking: () => void
  onClearPin: () => void
  onPosted: () => void
}) {
  const t = useT()
  const router = useRouter()
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)

  async function submit() {
    const text = body.trim()
    if (text.length === 0 || pending) return
    setPending(true)
    const res = await postComment({
      contentItemId: contentId,
      body: text,
      visibility: "client",
      annotation: pin ? { contentMediaId: pin.contentMediaId, x: pin.x, y: pin.y } : null,
    })
    setPending(false)
    if (!res.ok) {
      toast.error(t("portal.annotation.postError"))
      return
    }
    setBody("")
    onPosted()
    toast.success(t("portal.annotation.posted"), {
      description: t("portal.annotation.postedDetail"),
    })
    router.refresh()
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-sm font-semibold">
          {t("portal.annotation.composerTitle")}
        </h2>

        {pin ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2 py-1 text-xs font-medium text-accent-foreground">
            <MapPin className="size-3.5" />
            {t("portal.annotation.pinnedOnSlide", { index: pin.slideIndex + 1 })}
            <button
              type="button"
              onClick={onClearPin}
              aria-label={t("portal.annotation.removePin")}
              className="rounded-sm transition-opacity hover:opacity-70"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : null}

        {canPin ? (
          <Button
            type="button"
            size="sm"
            variant={picking ? "secondary" : "outline"}
            onClick={onTogglePicking}
            aria-pressed={picking}
          >
            <MapPin />
            {picking ? t("portal.annotation.pickingCancel") : t("portal.annotation.pinAction")}
          </Button>
        ) : null}
      </div>

      <p className={cn("text-xs", picking ? "font-medium text-primary" : "text-muted-foreground")}>
        {picking ? t("portal.annotation.pickingHint") : t("portal.annotation.composerHint")}
      </p>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("portal.annotation.composerPlaceholder")}
        aria-label={t("portal.annotation.composerAriaLabel")}
        rows={3}
      />

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending || body.trim().length === 0}>
          <Send />
          {t("portal.annotation.send")}
        </Button>
      </div>
    </div>
  )
}
