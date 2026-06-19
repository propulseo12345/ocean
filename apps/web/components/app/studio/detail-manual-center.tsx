"use client"

import { BellRing, Check, CircleCheck, Copy, ExternalLink, Hand } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { TargetStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format"
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

const APP_LABELS: Partial<Record<Platform, string>> = {
  tiktok: "l'app TikTok",
  newsletter: "l'outil d'envoi",
  custom: "le canal concerné",
  instagram: "l'app Instagram",
  facebook: "l'app Facebook",
}

function itemTitle(platform: Platform, status: ContentTarget["status"]): string {
  if (platform === "tiktok") return "Brouillon TikTok à finaliser"
  if (platform === "newsletter") return "Newsletter à envoyer"
  if (platform === "custom") return "Publication sur mesure"
  return status === "awaiting_manual" ? "À publier manuellement" : "Publication manuelle"
}

export function DetailManualCenter({
  items,
  caption,
  hashtags,
  scheduledAt,
  timezone,
}: {
  items: ManualItem[]
  caption: string
  hashtags: string[]
  scheduledAt: string | null
  timezone: string
}) {
  const [steps, setSteps] = useState<Record<string, StepState>>({})

  const stateOf = (id: string): StepState =>
    steps[id] ?? { copied: false, done: false, permalink: "" }
  const patch = (id: string, partial: Partial<StepState>) =>
    setSteps((prev) => ({ ...prev, [id]: { ...stateOf(id), ...partial } }))

  async function copyCaption(item: ManualItem) {
    const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
    const text = [item.target.captionOverride ?? caption, tags].filter(Boolean).join("\n\n")
    try {
      await navigator.clipboard.writeText(text)
      patch(item.target.id, { copied: true })
      toast.success("Légende copiée dans le presse-papier")
    } catch {
      toast.error("Copie impossible dans ce navigateur")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Hand className="size-4 text-muted-foreground" />
          Publication manuelle ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const state = stateOf(item.target.id)
          return (
            <div key={item.target.id} className="space-y-2.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformIcon platform={item.target.platform} className="size-4" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {itemTitle(item.target.platform, item.target.status)}
                </p>
                {state.done ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <CircleCheck className="size-3.5" />
                    Publié manuellement
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
                  Marquée publiée{state.permalink ? " — lien enregistré" : ""} (aperçu).
                </p>
              ) : (
                <ol className="space-y-2">
                  <Step index={1} done={state.copied} label="Copier la légende">
                    <Button size="xs" variant="outline" onClick={() => copyCaption(item)}>
                      {state.copied ? <Check /> : <Copy />}
                      {state.copied ? "Copiée" : "Copier"}
                    </Button>
                  </Step>
                  <Step
                    index={2}
                    done={false}
                    label={`Ouvrir ${APP_LABELS[item.target.platform] ?? "l'app"}`}
                  >
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        toast.info(
                          `Ouvre ${APP_LABELS[item.target.platform] ?? "l'app"} pour finaliser`,
                          {
                            description: "Étape simulée (aperçu).",
                          }
                        )
                      }
                    >
                      <ExternalLink />
                      Ouvrir
                    </Button>
                  </Step>
                  <Step index={3} done={false} label="Marquer comme publié">
                    <div className="flex w-full flex-wrap items-center gap-1.5">
                      <Input
                        value={state.permalink}
                        onChange={(e) => patch(item.target.id, { permalink: e.target.value })}
                        placeholder="Lien de la publication (optionnel)"
                        aria-label="Lien de la publication"
                        className="h-7 min-w-0 flex-1 text-xs"
                      />
                      <Button
                        size="xs"
                        onClick={() => {
                          patch(item.target.id, { done: true })
                          toast.success("Cible marquée publiée manuellement", {
                            description: "État local simulé (aperçu).",
                          })
                        }}
                      >
                        <CircleCheck />
                        Publié
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
  let label: string
  if (target.status === "pushed_to_platform" && target.publishedAt) {
    const reminder = new Date(new Date(target.publishedAt).getTime() + hours(24)).toISOString()
    label = `Relance le ${formatDateTime(reminder, timezone)} si le brouillon n'est pas publié.`
  } else if (scheduledAt) {
    label = `Rappel prévu le ${formatDateTime(scheduledAt, timezone)} (heure du client).`
  } else {
    label = "Sans date — programme le contenu pour planifier un rappel."
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
