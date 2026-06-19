"use client"

import { ImageOff, RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { FormatIcon } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { Button } from "@/components/ui/button"
import { formatDate, formatRelative } from "@/lib/format"
import { formatMeta } from "@/lib/mocks/labels"
import type { ContentItem } from "@/lib/mocks/types"
import { ConfirmDialog } from "./confirm-dialog"
import { TRASH_GRACE_DAYS } from "./constants"

export function TrashList({ items: initial }: { items: ContentItem[] }) {
  const [items, setItems] = useState(initial)
  const [toPurge, setToPurge] = useState<ContentItem | null>(null)

  function restore(item: ContentItem) {
    setItems((prev) => prev.filter((c) => c.id !== item.id))
    toast.success("Contenu restauré (aperçu)", { description: item.title })
  }

  function purge() {
    if (!toPurge) return
    setItems((prev) => prev.filter((c) => c.id !== toPurge.id))
    toast.warning("Contenu supprimé définitivement (aperçu)", { description: toPurge.title })
    setToPurge(null)
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title="Corbeille vide"
        description={`Les contenus supprimés sont conservés ${TRASH_GRACE_DAYS} jours avant purge des médias, puis restaurables jusque-là.`}
      />
    )
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Les contenus supprimés sont conservés {TRASH_GRACE_DAYS} jours avant la purge des médias.
      </p>
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
            {item.media[0] ? (
              <MediaThumb
                media={item.media[0]}
                alt={item.title}
                className="size-10 shrink-0 rounded-md"
                sizes="40px"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImageOff className="size-4" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <FormatIcon format={item.format} className="size-3.5" />
                {formatMeta[item.format].label}
                {item.deletedAt ? (
                  <span title={formatDate(item.deletedAt)}>
                    · supprimé {formatRelative(item.deletedAt)}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => restore(item)}>
                <RotateCcw />
                <span className="hidden sm:inline">Restaurer</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setToPurge(item)}
                aria-label={`Supprimer définitivement ${item.title}`}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toPurge !== null}
        onOpenChange={(open) => !open && setToPurge(null)}
        title="Supprimer définitivement ?"
        description={
          <>
            « {toPurge?.title} » sera retiré de la corbeille sans possibilité de restauration. En
            réel, les médias associés sont purgés.
          </>
        }
        confirmLabel="Supprimer définitivement (aperçu)"
        onConfirm={purge}
      />
    </>
  )
}
