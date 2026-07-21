"use client"

import { ArrowLeft, Lightbulb, PenLine, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { nowIso } from "@/lib/clock"
import { pick, useFormat, useLocale, useT } from "@/lib/i18n"
import type { Client, ContentItem, ContentPillar } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

// Banque d'idées du client : capture rapide (état local), tri par pilier
// éditorial et transformation d'une idée en brouillon via le composer.

const NO_PILLAR = "none"

// Identifiant local stable (jamais Date.now() : déterministe, SSR-safe).
let ideaSeq = 0
function nextIdeaId(): string {
  ideaSeq += 1
  return `idea_local_${ideaSeq}`
}

interface IdeaEntry {
  id: string
  title: string
  caption: string
  pillarId?: string
  createdAt: string
  /** Présent pour les idées mockées — lien vers le détail studio. */
  contentId?: string
}

function IdeaCard({ idea, client }: { idea: IdeaEntry; client: Client }) {
  const t = useT()
  const f = useFormat()
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <div className="min-w-0 flex-1 space-y-1">
        {idea.contentId ? (
          <Link
            href={routes.content(client.id, idea.contentId)}
            className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
          >
            {idea.title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm font-medium leading-snug">{idea.title}</p>
        )}
        {idea.caption ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{idea.caption}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {t("studio.ideaBank.noted", { ago: f.relative(idea.createdAt) })}
        </span>
        <Button variant="outline" size="xs" render={<Link href={routes.contentNew(client.id)} />}>
          <PenLine />
          {t("studio.ideaBank.transform")}
        </Button>
      </div>
    </div>
  )
}

export function BoardIdeaBank({
  client,
  ideas,
  pillars,
}: {
  client: Client
  ideas: ContentItem[]
  pillars: ContentPillar[]
}) {
  const t = useT()
  const { locale } = useLocale()
  const [captured, setCaptured] = useState<IdeaEntry[]>([])
  const [draft, setDraft] = useState("")
  const [pillarId, setPillarId] = useState<string>(NO_PILLAR)

  const entries: IdeaEntry[] = [
    ...captured,
    ...ideas.map((it) => ({
      id: it.id,
      title: pick(it.title, locale),
      caption: pick(it.caption, locale),
      pillarId: it.pillarId,
      createdAt: it.createdAt,
      contentId: it.id,
    })),
  ]

  function capture() {
    const title = draft.trim()
    if (title.length === 0) return
    setCaptured((prev) => [
      {
        id: nextIdeaId(),
        title,
        caption: "",
        pillarId: pillarId === NO_PILLAR ? undefined : pillarId,
        createdAt: nowIso(),
      },
      ...prev,
    ])
    setDraft("")
    toast.success(t("studio.ideaBank.captured"), {
      description: t("studio.ideaBank.capturedDesc"),
    })
  }

  const known = new Set(pillars.map((p) => p.id))
  const sections: { pillar: ContentPillar | null; items: IdeaEntry[] }[] = [
    ...pillars.map((pillar) => ({
      pillar: pillar as ContentPillar | null,
      items: entries.filter((e) => e.pillarId === pillar.id),
    })),
    { pillar: null, items: entries.filter((e) => !e.pillarId || !known.has(e.pillarId)) },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Lightbulb className="size-5 text-warning" />
            {t("studio.ideaBank.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.ideaBank.subtitle", { count: entries.length })}
          </p>
        </div>
        <Button variant="ghost" render={<Link href={routes.clientContent(client.id)} />}>
          <ArrowLeft />
          {t("studio.ideaBank.back")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card/40 p-3 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          placeholder={t("studio.ideaBank.capturePlaceholder")}
          aria-label={t("studio.ideaBank.captureAria")}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Select value={pillarId} onValueChange={(v) => setPillarId(String(v))}>
            <SelectTrigger size="sm" className="w-44" aria-label={t("studio.ideaBank.pillarAria")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PILLAR}>{t("studio.ideaBank.noPillar")}</SelectItem>
              {pillars.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {pick(p.name, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={capture} disabled={draft.trim().length === 0}>
            <Plus />
            {t("studio.ideaBank.capture")}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={t("studio.ideaBank.emptyTitle")}
          description={t("studio.ideaBank.emptyDescription")}
        />
      ) : (
        sections.map(({ pillar, items }) => (
          <section key={pillar?.id ?? NO_PILLAR} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: pillar?.colorVar ?? "var(--muted-foreground)" }}
              />
              {pillar ? pick(pillar.name, locale) : t("studio.ideaBank.noPillar")}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} client={client} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
