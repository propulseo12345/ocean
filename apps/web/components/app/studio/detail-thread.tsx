"use client"

import { EyeOff, MessageSquare } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loc, useT } from "@/lib/i18n"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { Comment } from "@/lib/mocks/types"
import { CommentRow, NoteRow, ThreadComposer } from "./detail-thread-items"

// Fil de discussion du contenu, en deux couches étanches :
// « Client » = miroir du portail (retours reviewer + réponses owner) ;
// « Interne » = notes de travail jamais exposées au client.
// Retours client marquables « Résolu » — état local (aperçu).

interface InternalNote {
  id: string
  body: string
  createdAt: string
}

export function DetailThread({
  comments,
  internalNotes,
  reviewerName,
}: {
  comments: Comment[]
  internalNotes?: string
  reviewerName?: string
}) {
  const t = useT()
  const [replies, setReplies] = useState<Comment[]>([])
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [resolved, setResolved] = useState<Record<string, boolean>>({})
  const [clientDraft, setClientDraft] = useState("")
  const [internalDraft, setInternalDraft] = useState("")

  const pinned = comments.filter((c) => c.annotation)
  const clientThread = [...comments, ...replies]
  const reviewerComments = comments.filter((c) => c.role === "reviewer")
  const resolvedCount = reviewerComments.filter((c) => resolved[c.id]).length
  const internalCount = notes.length + (internalNotes ? 1 : 0)

  function sendReply() {
    const body = clientDraft.trim()
    if (body.length === 0) return
    setReplies((prev) => [
      ...prev,
      {
        id: `cm_local_${prev.length}`,
        contentId: comments[0]?.contentId ?? "local",
        authorName: "Étienne Mercier",
        role: "owner",
        // Réponse locale (aperçu) saisie dans la locale active, dupliquée.
        body: loc(body, body),
        createdAt: MOCK_NOW.toISOString(),
      },
    ])
    setClientDraft("")
    toast.success(t("studio.thread.replySent"), {
      description: t("studio.thread.replySentDesc"),
    })
  }

  function addNote() {
    const body = internalDraft.trim()
    if (body.length === 0) return
    setNotes((prev) => [
      ...prev,
      { id: `note_local_${prev.length}`, body, createdAt: MOCK_NOW.toISOString() },
    ])
    setInternalDraft("")
    toast.success(t("studio.thread.noteAdded"), {
      description: t("studio.thread.noteAddedDesc"),
    })
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
                    isResolved={Boolean(resolved[comment.id])}
                    onToggleResolved={
                      comment.role === "reviewer"
                        ? () =>
                            setResolved((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))
                        : undefined
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
                {notes.map((note) => (
                  <NoteRow key={note.id} body={note.body} createdAt={note.createdAt} />
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
