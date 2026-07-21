"use client"

import { Check, MapPin, Send, StickyNote } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Comment } from "@/lib/domain"
import { initials } from "@/lib/format"
import { useFormat, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Sous-composants du fil de discussion (detail-thread) : message client,
// note interne et zone de saisie commune.

export function CommentRow({
  comment,
  pinOrder,
  isResolved,
  onToggleResolved,
}: {
  comment: Comment
  pinOrder: number | null
  isResolved: boolean
  onToggleResolved?: () => void
}) {
  const t = useT()
  const f = useFormat()
  const isOwner = comment.role === "owner"
  return (
    <li className={cn("flex gap-2.5", isResolved && "opacity-60")}>
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback>{initials(comment.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium">{comment.authorName}</span>
          <Badge variant={isOwner ? "secondary" : "outline"} className="h-4 px-1.5 text-[10px]">
            {isOwner ? t("studio.threadItems.me") : t("studio.threadItems.client")}
          </Badge>
          {pinOrder !== null && comment.annotation ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/85 text-[10px] font-semibold text-primary-foreground">
                {pinOrder}
              </span>
              <MapPin className="size-3" />
              {t("studio.threadItems.slide", { n: comment.annotation.slideIndex + 1 })}
            </span>
          ) : null}
          {isResolved ? (
            <Badge
              variant="outline"
              className="h-4 gap-0.5 border-success/40 px-1.5 text-[10px] text-success"
            >
              <Check className="size-2.5" />
              {t("studio.threadItems.resolved")}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-foreground/90">{comment.body}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">
            {f.relative(comment.createdAt)}
          </span>
          {onToggleResolved ? (
            <Button variant="ghost" size="xs" className="h-5 px-1.5" onClick={onToggleResolved}>
              {isResolved ? t("studio.threadItems.reopen") : t("studio.threadItems.markResolved")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function NoteRow({
  body,
  createdAt,
  label,
}: {
  body: string
  createdAt: string | null
  label?: string
}) {
  const f = useFormat()
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
        <StickyNote className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Étienne Mercier</span>
          {label ? (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {label}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-foreground/90">{body}</p>
        {createdAt ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">{f.relative(createdAt)}</p>
        ) : null}
      </div>
    </li>
  )
}

export function ThreadComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  hint,
  submitLabel,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  placeholder: string
  hint: string
  submitLabel: string
}) {
  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        className="min-h-16 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        <Button size="sm" onClick={onSubmit} disabled={value.trim().length === 0}>
          <Send />
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
