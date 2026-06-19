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
} from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { BoardBatchActions } from "./board-batch-actions"
import { BoardKanban } from "./board-kanban"
import { BoardQuotas } from "./board-quotas"
import { BoardReviewBanner } from "./board-review-banner"
import { BoardReviewDialog } from "./board-review-dialog"
import { useBoardState } from "./board-state"
import { BoardToolbar } from "./board-toolbar"
import { CANONICAL_LABELS, type QuotaRow } from "./board-types"
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
  const board = useBoardState({
    items,
    savedViews,
    reviewer,
    initialRequest: reviewRequest,
  })
  const selection = useMultiSelect()
  const [reviewOpen, setReviewOpen] = useState(false)

  const platforms = useMemo(() => {
    const set = new Set<Platform>()
    for (const it of items) for (const t of it.targets) set.add(t.platform)
    return [...set]
  }, [items])

  const allLabels = useMemo(
    () => collectLabels(board.boardItems, CANONICAL_LABELS),
    [board.boardItems]
  )
  const reviewCandidates = useMemo(() => board.boardItems.filter(canSendReview), [board.boardItems])

  function remindFor(item: ContentItem) {
    board.remind()
    toast.success(`Relance envoyée pour « ${item.title} » (aperçu)`, {
      description: reviewer
        ? `${reviewer.name} recevrait un email Brevo avec le lien direct du portail.`
        : "Le reviewer recevrait un email Brevo avec le lien direct du portail.",
    })
  }

  function confirmReview(ids: string[], message: string) {
    board.sendReviewRequest(ids, message, client.id)
    setReviewOpen(false)
    selection.clear()
    toast.success(
      `Demande de validation envoyée${reviewer ? ` à ${reviewer.name}` : ""} (aperçu)`,
      {
        description: `${ids.length} contenu${ids.length > 1 ? "s" : ""} en revue · email récapitulatif mocké (Brevo).`,
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
          <h2 className="font-heading text-lg font-semibold">Studio de contenu</h2>
          <p className="text-sm text-muted-foreground">
            Pipeline de production · fuseau {client.timezone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href={routes.clientIdeas(client.id)} />}>
            <Lightbulb />
            Banque d'idées
          </Button>
          <Button
            variant="outline"
            onClick={() => setReviewOpen(true)}
            disabled={reviewCandidates.length === 0}
          >
            <Send />
            Demander une validation
          </Button>
          <Button render={<Link href={routes.contentNew(client.id)} />}>
            <Plus />
            Nouveau contenu
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
            title="Aucun contenu pour ce client"
            description="Crée un premier contenu : médias, légende, ciblage des plateformes — tout part d'ici."
            action={
              <Button render={<Link href={routes.contentNew(client.id)} />}>
                <Plus />
                Créer un contenu
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            title="Aucun contenu ne correspond"
            description="Ajuste la recherche ou les filtres pour voir d'autres contenus."
            action={
              isFiltered ? (
                <Button variant="outline" size="sm" onClick={board.resetFilters}>
                  Réinitialiser les filtres
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
