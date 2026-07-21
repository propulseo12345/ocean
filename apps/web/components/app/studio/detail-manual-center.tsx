"use client"

import { BellRing, Check, CircleCheck, Copy, ExternalLink, Hand } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { TargetStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { markTargetPublishedManually } from "@/lib/actions/content-status"
import { type MessageKey, type Translator, useFormat, useT } from "@/lib/i18n"
import { hours } from "@/lib/mocks/time"
import type { ContentTarget, Platform, SocialAccount } from "@/lib/mocks/types"

// Centre de publication manuelle : brouillons TikTok poussés, newsletter et
// canaux sur mesure. Checklist guidée — copier la légende (vrai presse-papier),
// ouvrir l'app, marquer comme publié (état local + permalink optionnel).

export interface ManualItem {
  target: ContentTarget
  account: SocialAccount | null
}

interface StepState {
  copied: boolean
  done: boolean
  permalink: string
}

const APP_LABEL_KEYS: Partial<Record<Platform, MessageKey>> = {
  tiktok: "studio.manual.appTiktok",
  newsletter: "studio.manual.appNewsletter",
  custom: "studio.manual.appCustom",
  instagram: "studio.manual.appInstagram",
  facebook: "studio.manual.appFacebook",
}

function appLabel(t: Translator, platform: Platform): string {
  const key = APP_LABEL_KEYS[platform]
  return key ? t(key) : t("studio.manual.appFallback")
}

function itemTitle(t: Translator, platform: Platform, status: ContentTarget["status"]): string {
  if (platform === "tiktok") return t("studio.manual.titleTiktok")
  if (platform === "newsletter") return t("studio.manual.titleNewsletter")
  if (platform === "custom") return t("studio.manual.titleCustom")
  return status === "awaiting_manual"
    ? t("studio.manual.titleAwaiting")
    : t("studio.manual.titleGeneric")
}

export function DetailManualCenter({
  items,
  clientId,
  contentId,
  caption,
  hashtags,
  scheduledAt,
  timezone,
}: {
  items: ManualItem[]
  clientId: string
  contentId: string
  caption: string
  hashtags: string[]
  scheduledAt: string | null
  timezone: string
}) {
  const t = useT()
  const router = useRouter()
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)

  const stateOf = (id: string): StepState =>
    steps[id] ?? { copied: false, done: false, permalink: "" }
  const patch = (id: string, partial: Partial<StepState>) =>
    setSteps((prev) => ({ ...prev, [id]: { ...stateOf(id), ...partial } }))

  // Déclaration « publié manuellement » : passe par la RPC (status='published'
  // interdit à authenticated). Le lien saisi est optionnel. Après succès, on
  // rafraîchit pour refléter le statut agrégé (partiellement/entièrement publié).
  async function markPublished(item: ManualItem) {
    if (pendingId) return
    setPendingId(item.target.id)
    const link = stateOf(item.target.id).permalink.trim()
    const res = await markTargetPublishedManually({
      clientId,
      contentId,
      targetId: item.target.id,
      permalink: link ? link : undefined,
    })
    setPendingId(null)
    if (!res.ok) {
      toast.error(t("studio.manual.markError"))
      return
    }
    patch(item.target.id, { done: true })
    toast.success(t("studio.manual.markedDone"), {
      description: t("studio.manual.markedDoneDesc"),
    })
    router.refresh()
  }

  async function copyCaption(item: ManualItem) {
    const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
    // La légende de base arrive résolue ; la déclinaison par cible reste string.
    const captionText = item.target.captionOverride ? item.target.captionOverride : caption
    const text = [captionText, tags].filter(Boolean).join("\n\n")
    try {
      await navigator.clipboard.writeText(text)
      patch(item.target.id, { copied: true })
      toast.success(t("studio.manual.captionCopied"))
    } catch {
      toast.error(t("studio.manual.copyFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Hand className="size-4 text-muted-foreground" />
          {t("studio.manual.heading", { count: items.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const state = stateOf(item.target.id)
          const app = appLabel(t, item.target.platform)
          return (
            <div key={item.target.id} className="space-y-2.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformIcon platform={item.target.platform} className="size-4" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {itemTitle(t, item.target.platform, item.target.status)}
                </p>
                {state.done ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <CircleCheck className="size-3.5" />
                    {t("studio.manual.publishedManually")}
                  </span>
                ) : (
                  <TargetStatusBadge status={item.target.status} />
                )}
              </div>

              {item.account ? (
                <p className="text-xs text-muted-foreground">@{item.account.username}</p>
              ) : null}

              <ReminderLine target={item.target} scheduledAt={scheduledAt} timezone={timezone} />

              {state.done ? (
                <p className="text-xs text-muted-foreground">
                  {t("studio.manual.markedPublished", {
                    withLink: state.permalink ? t("studio.manual.markedPublishedLink") : "",
                  })}
                </p>
              ) : (
                <ol className="space-y-2">
                  <Step index={1} done={state.copied} label={t("studio.manual.stepCopy")}>
                    <Button size="xs" variant="outline" onClick={() => copyCaption(item)}>
                      {state.copied ? <Check /> : <Copy />}
                      {state.copied ? t("studio.manual.copied") : t("studio.manual.copy")}
                    </Button>
                  </Step>
                  <Step index={2} done={false} label={t("studio.manual.stepOpen", { app })}>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        toast.info(t("studio.manual.openHint", { app }), {
                          description: t("studio.manual.openHintDesc"),
                        })
                      }
                    >
                      <ExternalLink />
                      {t("studio.manual.open")}
                    </Button>
                  </Step>
                  <Step index={3} done={false} label={t("studio.manual.stepMark")}>
                    <div className="flex w-full flex-wrap items-center gap-1.5">
                      <Input
                        value={state.permalink}
                        onChange={(e) => patch(item.target.id, { permalink: e.target.value })}
                        placeholder={t("studio.manual.linkPlaceholder")}
                        aria-label={t("studio.manual.linkAria")}
                        className="h-7 min-w-0 flex-1 text-xs"
                      />
                      <Button
                        size="xs"
                        onClick={() => markPublished(item)}
                        disabled={pendingId === item.target.id}
                      >
                        <CircleCheck />
                        {t("studio.manual.markDone")}
                      </Button>
                    </div>
                  </Step>
                </ol>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ReminderLine({
  target,
  scheduledAt,
  timezone,
}: {
  target: ContentTarget
  scheduledAt: string | null
  timezone: string
}) {
  const t = useT()
  const f = useFormat()
  let label: string
  if (target.status === "pushed_to_platform" && target.publishedAt) {
    const reminder = new Date(new Date(target.publishedAt).getTime() + hours(24)).toISOString()
    label = t("studio.manual.reminderPushed", { date: f.dateTime(reminder, timezone) })
  } else if (scheduledAt) {
    label = t("studio.manual.reminderScheduled", { date: f.dateTime(scheduledAt, timezone) })
  } else {
    label = t("studio.manual.reminderNoDate")
  }
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground tabular-nums">
      <BellRing className="mt-px size-3 shrink-0" />
      {label}
    </p>
  )
}

function Step({
  index,
  done,
  label,
  children,
}: {
  index: number
  done: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="size-3" /> : index}
      </span>
      <span className="min-w-0 flex-1 text-xs">{label}</span>
      {children}
    </li>
  )
}
