"use client"

import { Lightbulb, Plus, Send, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ContentCard } from "@/components/app/studio/content-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { useMultiSelect } from "@/hooks/use-multi-select"
import type {
  Client,
  ContentItem,
  ContentPillar,
  Platform,
  Reviewer,
  ReviewRequest,
  SavedView,
} from "@/lib/domain"
import { useLocale, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { BoardBatchActions } from "./board-batch-actions"
import { BoardKanban } from "./board-kanban"
import { BoardQuotas } from "./board-quotas"
import { BoardReviewBanner } from "./board-review-banner"
import { BoardReviewDialog } from "./board-review-dialog"
import { useBoardState } from "./board-state"
import { BoardToolbar } from "./board-toolbar"
import { CANONICAL_LABEL_KEYS, type QuotaRow } from "./board-types"
import { canSendReview, cardReviewMeta, collectLabels, filtersAreEmpty } from "./board-utils"
import { BoardViews } from "./board-views"

// Poste de pilotage du studio : recherche, vues enregistrées, sélection
// multiple, envoi en revue groupé, kanban de production et jauges de quotas.

export function ContentBoard({
  client,
  items,
  savedViews,
  reviewer,
  reviewRequest,
  quotas,
  pillars,
}: {
  client: Client
  items: ContentItem[]
  savedViews: SavedView[]
  reviewer: Reviewer | null
  reviewRequest: ReviewRequest | null
  quotas: QuotaRow[]
  pillars: ContentPillar[]
}) {
  const t = useT()
  const { locale } = useLocale()
  const board = useBoardState({
    clientId: client.id,
    items,
    savedViews,
    reviewer,
    initialRequest: reviewRequest,
  })
  const selection = useMultiSelect()
  const [reviewOpen, setReviewOpen] = useState(false)

  const platforms = useMemo(() => {
    const set = new Set<Platform>()
    for (const it of items) for (const tg of it.targets) set.add(tg.platform)
    return [...set]
  }, [items])

  const allLabels = useMemo(
    () =>
      collectLabels(
        board.boardItems,
        CANONICAL_LABEL_KEYS.map((k) => t(k)),
        locale
      ),
    [board.boardItems, t, locale]
  )
  const reviewCandidates = useMemo(() => board.boardItems.filter(canSendReview), [board.boardItems])

  function remindFor(item: ContentItem) {
    board.remind()
    toast.success(t("studio.board.remindSent", { title: item.title }), {
      description: reviewer
        ? t("studio.board.remindDescReviewer", { name: reviewer.name })
        : t("studio.board.remindDescNoReviewer"),
    })
  }

  async function confirmReview(ids: string[], message: string) {
    setReviewOpen(false)
    selection.clear()
    const res = await board.sendReviewRequest(ids, message)
    if (res.failed > 0 && res.ok === 0) {
      toast.error(t("studio.board.reviewError"))
      return
    }
    toast.success(
      reviewer
        ? t("studio.board.reviewSentTo", { name: reviewer.name })
        : t("studio.board.reviewSent"),
      {
        description: t("studio.board.reviewSentDesc", { count: res.ok }),
      }
    )
  }

  const filtered = board.filteredItems
  const noContent = board.boardItems.length === 0
  const isFiltered = !filtersAreEmpty(board.filters)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="font-heading text-lg font-semibold">{t("studio.board.heading")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.board.subtitle", { tz: client.timezone })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href={routes.clientIdeas(client.id)} />}>
            <Lightbulb />
            {t("studio.board.ideaBank")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setReviewOpen(true)}
            disabled={reviewCandidates.length === 0}
          >
            <Send />
            {t("studio.board.requestReview")}
          </Button>
          <Button render={<Link href={routes.contentNew(client.id)} />}>
            <Plus />
            {t("studio.board.newContent")}
          </Button>
        </div>
      </div>

      <BoardQuotas rows={quotas} />
      <BoardReviewBanner board={board} />
      <BoardViews board={board} clientId={client.id} />
      <BoardToolbar
        board={board}
        platforms={platforms}
        pillars={pillars}
        labels={allLabels}
        resultCount={filtered.length}
        totalCount={board.boardItems.length}
      />

      {filtered.length === 0 ? (
        noContent ? (
          <EmptyState
            icon={Plus}
            title={t("studio.board.emptyTitle")}
            description={t("studio.board.emptyDescription")}
            action={
              <Button render={<Link href={routes.contentNew(client.id)} />}>
                <Plus />
                {t("studio.board.emptyAction")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            title={t("studio.board.noMatchTitle")}
            description={t("studio.board.noMatchDescription")}
            action={
              isFiltered ? (
                <Button variant="outline" size="sm" onClick={board.resetFilters}>
                  {t("studio.board.resetFilters")}
                </Button>
              ) : undefined
            }
          />
        )
      ) : board.mode === "kanban" ? (
        <BoardKanban items={filtered} client={client} board={board} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((it) => (
            <ContentCard
              key={it.id}
              client={client}
              content={it}
              selected={selection.isSelected(it.id)}
              onToggleSelect={() => selection.toggle(it.id)}
              allLabels={allLabels}
              onLabelsChange={(labels) => board.setItemLabels(it.id, labels)}
              reviewMeta={cardReviewMeta(it, board.request, reviewer)}
              onRemind={() => remindFor(it)}
            />
          ))}
        </div>
      )}

      <BoardBatchActions
        board={board}
        selection={selection}
        client={client}
        allLabels={allLabels}
        onOpenReview={() => setReviewOpen(true)}
      />

      <BoardReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        reviewer={reviewer}
        candidates={reviewCandidates}
        preselectedIds={selection.selectedIds}
        onConfirm={confirmReview}
      />
    </div>
  )
}
