"use client"

import { EyeOff, MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { postComment, toggleCommentResolved } from "@/lib/actions/collaboration"
import type { Comment } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { CommentRow, NoteRow, ThreadComposer } from "./detail-thread-items"

// Fil de discussion du contenu, en deux couches étanches :
// « Client » = miroir du portail (retours reviewer + réponses owner, persistés
// visibility='client') ; « Interne » = notes de travail persistées
// visibility='internal', jamais lisibles par le reviewer (RLS). Les deux couches
// arrivent dans `comments` (l'owner est org member) et sont séparées ici par
// leur visibilité. Retours client marquables « Résolu » (persisté resolved_at).

export function DetailThread({
  comments,
  contentId,
  internalNotes,
  reviewerName,
}: {
  comments: Comment[]
  contentId: string
  internalNotes?: string
  reviewerName?: string
}) {
  const t = useT()
  const router = useRouter()
  const [clientDraft, setClientDraft] = useState("")
  const [internalDraft, setInternalDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  // Surcharge optimiste de l'état résolu (id → résolu), au-dessus de resolvedAt
  // serveur. Vidée par le refresh qui relit la ligne canonique.
  const [resolvedOverride, setResolvedOverride] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})

  const clientThread = comments.filter((c) => c.visibility === "client")
  const internalComments = comments.filter((c) => c.visibility === "internal")
  const pinned = clientThread.filter((c) => c.annotation)
  const reviewerComments = clientThread.filter((c) => c.role === "reviewer")

  const isResolved = (c: Comment) => resolvedOverride[c.id] ?? Boolean(c.resolvedAt)
  const resolvedCount = reviewerComments.filter(isResolved).length
  const internalCount = internalComments.length + (internalNotes ? 1 : 0)

  // Réponse owner au client → commentaire persisté (visibility='client', visible
  // sur le portail). Pas d'ajout optimiste local : on rafraîchit pour lire la
  // ligne canonique (getComments) et éviter tout doublon.
  async function sendReply() {
    const body = clientDraft.trim()
    if (body.length === 0 || sending) return
    setSending(true)
    const res = await postComment({ contentItemId: contentId, body, visibility: "client" })
    setSending(false)
    if (!res.ok) {
      toast.error(t("studio.thread.replyError"))
      return
    }
    setClientDraft("")
    toast.success(t("studio.thread.replySent"), {
      description: t("studio.thread.replySentDesc"),
    })
    router.refresh()
  }

  // Note interne → commentaire persisté (visibility='internal', jamais exposé au
  // portail par la RLS). Même logique que la réponse : refresh, pas d'optimiste.
  async function addNote() {
    const body = internalDraft.trim()
    if (body.length === 0 || savingNote) return
    setSavingNote(true)
    const res = await postComment({ contentItemId: contentId, body, visibility: "internal" })
    setSavingNote(false)
    if (!res.ok) {
      toast.error(t("studio.thread.noteError"))
      return
    }
    setInternalDraft("")
    toast.success(t("studio.thread.noteAdded"), {
      description: t("studio.thread.noteAddedDesc"),
    })
    router.refresh()
  }

  // Marquer résolu / rouvrir un retour client (owner-only, persisté). Optimiste
  // + rollback : l'UI reflète l'intention immédiatement, revient en cas d'échec.
  async function toggleResolved(comment: Comment) {
    if (resolving[comment.id]) return
    const next = !isResolved(comment)
    setResolvedOverride((prev) => ({ ...prev, [comment.id]: next }))
    setResolving((prev) => ({ ...prev, [comment.id]: true }))
    const res = await toggleCommentResolved({
      contentItemId: contentId,
      commentId: comment.id,
      resolved: next,
    })
    setResolving((prev) => {
      const { [comment.id]: _, ...rest } = prev
      return rest
    })
    if (!res.ok) {
      setResolvedOverride((prev) => ({ ...prev, [comment.id]: !next }))
      toast.error(t("studio.thread.resolveError"))
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <MessageSquare className="size-4 text-muted-foreground" />
          {t("studio.thread.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client">
          <TabsList className="w-full">
            <TabsTrigger value="client">
              {t("studio.thread.tabClient", { count: clientThread.length })}
            </TabsTrigger>
            <TabsTrigger value="internal">
              {t("studio.thread.tabInternal", { count: internalCount })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-3">
            {reviewerComments.length > 0 ? (
              <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {t("studio.thread.reviewsHandled", {
                  resolved: resolvedCount,
                  total: reviewerComments.length,
                })}
              </p>
            ) : null}

            {clientThread.length > 0 ? (
              <ul className="space-y-3.5">
                {clientThread.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    pinOrder={pinOrderOf(pinned, comment.id)}
                    isResolved={isResolved(comment)}
                    onToggleResolved={
                      comment.role === "reviewer" ? () => toggleResolved(comment) : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                {t("studio.thread.noClientThread")}
              </p>
            )}

            <ThreadComposer
              value={clientDraft}
              onChange={setClientDraft}
              onSubmit={sendReply}
              placeholder={t("studio.thread.replyPlaceholder", {
                name: reviewerName ?? t("studio.thread.fallbackName"),
              })}
              hint={t("studio.thread.replyHint", {
                name: reviewerName ?? t("studio.thread.fallbackNameShort"),
              })}
              submitLabel={t("studio.thread.reply")}
            />
          </TabsContent>

          <TabsContent value="internal" className="space-y-3">
            <p className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] font-medium text-muted-foreground">
              <EyeOff className="size-3.5 shrink-0" />
              {t("studio.thread.internalBanner")}
            </p>

            {internalCount > 0 ? (
              <ul className="space-y-3.5">
                {internalNotes ? (
                  <NoteRow
                    body={internalNotes}
                    label={t("studio.thread.contentNote")}
                    createdAt={null}
                  />
                ) : null}
                {internalComments.map((note) => (
                  <NoteRow
                    key={note.id}
                    body={note.body}
                    author={note.authorName || undefined}
                    createdAt={note.createdAt}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                {t("studio.thread.noInternal")}
              </p>
            )}

            <ThreadComposer
              value={internalDraft}
              onChange={setInternalDraft}
              onSubmit={addNote}
              placeholder={t("studio.thread.notePlaceholder")}
              hint={t("studio.thread.noteHint")}
              submitLabel={t("studio.thread.noteAdd")}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function pinOrderOf(pinned: Comment[], id: string): number | null {
  const index = pinned.findIndex((c) => c.id === id)
  return index === -1 ? null : index + 1
}
