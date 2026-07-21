"use client"

import { ImageOff, RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { Button } from "@/components/ui/button"
import { useFormat, useLabels, useT } from "@/lib/i18n"
import type { ContentItem } from "@/lib/mocks/types"
import { ConfirmDialog } from "./confirm-dialog"
import { TRASH_GRACE_DAYS } from "./constants"

export function TrashList({ items: initial }: { items: ContentItem[] }) {
  const t = useT()
  const f = useFormat()
  const lbl = useLabels()
  const [items, setItems] = useState(initial)
  const [toPurge, setToPurge] = useState<ContentItem | null>(null)

  function restore(item: ContentItem) {
    setItems((prev) => prev.filter((c) => c.id !== item.id))
    toast.success(t("clientSettings.trash.restoredToast"), {
      description: item.title,
    })
  }

  function purge() {
    if (!toPurge) return
    setItems((prev) => prev.filter((c) => c.id !== toPurge.id))
    toast.warning(t("clientSettings.trash.purgedToast"), {
      description: toPurge.title,
    })
    setToPurge(null)
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title={t("clientSettings.trash.emptyTitle")}
        description={t("clientSettings.trash.emptyDescription", { days: TRASH_GRACE_DAYS })}
      />
    )
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {t("clientSettings.trash.retentionNote", { days: TRASH_GRACE_DAYS })}
      </p>
      <ul className="divide-y rounded-lg border">
        {items.map((item) => {
          const title = item.title
          return (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              {item.media[0] ? (
                <MediaThumb
                  media={item.media[0]}
                  alt={title}
                  className="size-10 shrink-0 rounded-md"
                  sizes="40px"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageOff className="size-4" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <FormatIcon format={item.format} className="size-3.5" />
                  {lbl.format(item.format)}
                  {item.deletedAt ? (
                    <span title={f.date(item.deletedAt)}>
                      {t("clientSettings.trash.deletedRelative", {
                        when: f.relative(item.deletedAt),
                      })}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => restore(item)}>
                  <RotateCcw />
                  <span className="hidden sm:inline">{t("clientSettings.trash.restore")}</span>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setToPurge(item)}
                  aria-label={t("clientSettings.trash.purgeAria", { title })}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={toPurge !== null}
        onOpenChange={(open) => !open && setToPurge(null)}
        title={t("clientSettings.trash.purgeDialogTitle")}
        description={t("clientSettings.trash.purgeDialogDescription", {
          title: toPurge ? toPurge.title : "",
        })}
        confirmLabel={t("clientSettings.trash.purgeConfirm")}
        onConfirm={purge}
      />
    </>
  )
}
