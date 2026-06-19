"use client"

import { Send, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { type Locale, useLabels, useLocale, useT } from "@/lib/i18n"
import type {
  BrandKit,
  Client,
  ContentFormat,
  ContentItem,
  ContentPillar,
  HashtagGroup,
  LibraryAsset,
  QuotaUsage,
  RecurringSlot,
  SocialAccount,
} from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { ComposerAdvanced } from "./composer-advanced"
import { ComposerBasics } from "./composer-basics"
import { ComposerCaption } from "./composer-caption"
import { ComposerHeader } from "./composer-header"
import { ComposerMediaSection } from "./composer-media"
import { ComposerPreview } from "./composer-preview"
import { ComposerTargets } from "./composer-targets"
import {
  type ComposerDraft,
  draftFromContent,
  emptyDraft,
  mediaFromLibrary,
} from "./composer-types"
import { targetedApiPlatforms } from "./composer-utils"
import { computePreflight, hasBlocking } from "./preflight"
import { PreflightPanel } from "./preflight-panel"
import { ScheduleDialog } from "./schedule-dialog"

// Composer studio : création/édition d'un contenu, plein écran en 2 colonnes
// (formulaire à gauche, aperçu + pré-flight à droite ; empilé sur mobile).
// Preview front : tout l'état vit en local, « Enregistrer » = toast + retour.

export interface ComposerData {
  client: Client
  accounts: SocialAccount[]
  pillars: ContentPillar[]
  hashtagGroups: HashtagGroup[]
  libraryAssets: LibraryAsset[]
  brandKit: BrandKit | null
  recurringSlots: RecurringSlot[]
  /** Quota par compte social (calculé côté serveur depuis les mocks). */
  quotas: Record<string, QuotaUsage | null>
}

/** Préremplissage à la création (depuis le calendrier ou la médiathèque). */
export interface ComposerPrefill {
  /** ISO UTC déjà résolu côté serveur (date+heure d'une case calendrier). */
  scheduledAt?: string | null
  /** Asset de médiathèque à présélectionner (« Créer un contenu avec ce média »). */
  mediaAssetId?: string
}

function initialDraft(
  data: ComposerData,
  content: ContentItem | null,
  locale: Locale,
  prefill?: ComposerPrefill
) {
  if (content) return draftFromContent(content, locale)
  const draft = emptyDraft(data.accounts)
  if (!prefill) return draft
  if (prefill.scheduledAt) draft.scheduledAt = prefill.scheduledAt
  if (prefill.mediaAssetId) {
    const asset = data.libraryAssets.find((a) => a.id === prefill.mediaAssetId)
    if (asset) draft.media = [mediaFromLibrary(asset, 0, locale)]
  }
  return draft
}

export function ComposerScreen({
  data,
  initialContent,
  prefill,
}: {
  data: ComposerData
  initialContent: ContentItem | null
  prefill?: ComposerPrefill
}) {
  const t = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  const router = useRouter()
  const [draft, setDraft] = useState<ComposerDraft>(() =>
    initialDraft(data, initialContent, locale, prefill)
  )
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const patch = useCallback((partial: Partial<ComposerDraft>) => {
    setDraft((d) => ({ ...d, ...partial }))
  }, [])

  const platforms = useMemo(
    () => targetedApiPlatforms(draft, data.accounts),
    [draft, data.accounts]
  )

  const preflight = useMemo(
    () =>
      computePreflight({
        draft,
        client: data.client,
        accounts: data.accounts,
        bannedWords: data.brandKit?.bannedWords ?? [],
        t,
        locale,
      }),
    [draft, data.client, data.accounts, data.brandKit, t, locale]
  )
  const blocking = hasBlocking(preflight)
  // La date se corrige DANS le dialog : elle ne bloque pas son ouverture.
  const schedulingErrors = preflight.filter((i) => i.severity === "error" && i.id !== "date")

  function handleFormatChange(format: ContentFormat) {
    if (format !== "carousel" && draft.media.length > 1) {
      patch({ format, media: draft.media.slice(0, 1) })
      toast.info(t("composer.screen.extraMediaRemoved"), {
        description: t("composer.screen.extraMediaRemovedDesc", { format: lbl.format(format) }),
      })
      return
    }
    patch({ format })
  }

  function handleSave() {
    toast.success(
      draft.scheduledAt ? t("composer.screen.savedScheduled") : t("composer.screen.savedDraft"),
      { description: t("composer.screen.savedDesc") }
    )
    router.push(routes.clientContent(data.client.id))
  }

  return (
    <div className="space-y-5">
      <ComposerHeader
        client={data.client}
        mode={initialContent ? "edit" : "create"}
        scheduledAt={draft.scheduledAt}
        blocked={blocking}
        onSave={handleSave}
        onOpenSchedule={() => setScheduleOpen(true)}
      />

      {initialContent?.status === "in_review" ? (
        <Alert className="border-warning/40 bg-warning/5">
          <Send className="text-warning" />
          <AlertTitle>{t("composer.screen.inReviewTitle")}</AlertTitle>
          <AlertDescription>{t("composer.screen.inReviewDesc")}</AlertDescription>
        </Alert>
      ) : null}
      {initialContent?.status === "scheduled" ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{t("composer.screen.scheduledTitle")}</AlertTitle>
          <AlertDescription>{t("composer.screen.scheduledDesc")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="min-w-0 space-y-5">
          <ComposerBasics
            draft={draft}
            pillars={data.pillars}
            onPatch={patch}
            onFormatChange={handleFormatChange}
          />
          <ComposerMediaSection
            draft={draft}
            platforms={platforms}
            libraryAssets={data.libraryAssets}
            onPatch={patch}
          />
          <ComposerTargets
            draft={draft}
            accounts={data.accounts}
            quotas={data.quotas}
            onPatch={patch}
          />
          <ComposerCaption
            draft={draft}
            platforms={platforms}
            hashtagGroups={data.hashtagGroups}
            bannedWords={data.brandKit?.bannedWords ?? []}
            onPatch={patch}
          />
          <ComposerAdvanced draft={draft} platforms={platforms} onPatch={patch} />
        </div>

        <aside className="min-w-0 space-y-5">
          <ComposerPreview client={data.client} draft={draft} platforms={platforms} />
          <PreflightPanel items={preflight} />
        </aside>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        client={data.client}
        slots={data.recurringSlots}
        scheduledAt={draft.scheduledAt}
        blockingCount={schedulingErrors.length}
        onConfirm={(iso) => patch({ scheduledAt: iso })}
      />
    </div>
  )
}
